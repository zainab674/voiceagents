import { supabase } from '#lib/supabase.js';

const normalizeString = (value) => typeof value === 'string' ? value.trim() : value;

const normalizeTags = (value) => {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value.map((tag) => (typeof tag === 'string' ? tag.trim() : tag)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return null;
};

export const createAgentTemplate = async (req, res) => {
  try {
    const {
      name,
      description,
      prompt,
      smsPrompt,
      firstMessage,
      calEventTypeSlug,
      calEventTypeId,
      calTimezone = 'UTC',
      knowledgeBaseId,
      isPublic = true,
      category,
      tags
    } = req.body;

    if (!name || !description || !prompt) {
      return res.status(400).json({
        success: false,
        message: 'Name, description, and prompt are required.'
      });
    }

    const userId = req.user.userId;
    const slugName = req.user.slugName;

    // Only main admin can create templates (whitelabel admins have slugName)
    if (slugName && slugName !== 'main' && slugName.trim() !== '') {
      return res.status(403).json({
        success: false,
        message: 'Only main admin can create templates. Whitelabel admins do not have access to this feature.'
      });
    }

    const payload = {
      name: normalizeString(name),
      description: normalizeString(description),
      prompt: normalizeString(prompt),
      sms_prompt: normalizeString(smsPrompt) || null,
      first_message: normalizeString(firstMessage) || null,
      cal_event_type_slug: normalizeString(calEventTypeSlug) || null,
      cal_event_type_id: normalizeString(calEventTypeId) || null,
      cal_timezone: normalizeString(calTimezone) || 'UTC',
      knowledge_base_id: knowledgeBaseId || null,
      is_public: Boolean(isPublic),
      category: normalizeString(category) || null,
      tags: normalizeTags(tags),
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('agent_templates')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('createAgentTemplate - Supabase error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create agent template',
        error: error.message
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Agent template created successfully',
      data: {
        template: data
      }
    });
  } catch (error) {
    console.error('createAgentTemplate - Unexpected error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const getAgentTemplates = async (req, res) => {
  try {
    const { search, category, includePrivate } = req.query;
    const userId = req.user?.userId;
    const role = req.user?.role;

    let query = supabase
      .from('agent_templates')
      .select('*')
      .order('updated_at', { ascending: false });

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,description.ilike.%${search}%,prompt.ilike.%${search}%`
      );
    }

    if (category) {
      query = query.eq('category', category);
    }

    const canSeePrivate = role === 'admin' && includePrivate === 'true';

    if (!canSeePrivate) {
      const filters = [`is_public.eq.true`];
      if (userId) {
        filters.push(`created_by.eq.${userId}`);
      }
      query = query.or(filters.join(','));
    }

    const { data, error } = await query;

    if (error) {
      console.error('getAgentTemplates - Supabase error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch agent templates',
        error: error.message
      });
    }

    return res.json({
      success: true,
      data: {
        templates: data || []
      }
    });
  } catch (error) {
    console.error('getAgentTemplates - Unexpected error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const getAgentTemplateById = async (req, res) => {
  try {
    const { templateId } = req.params;
    const userId = req.user?.userId;
    const role = req.user?.role;

    const { data, error } = await supabase
      .from('agent_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'Agent template not found'
        });
      }

      console.error('getAgentTemplateById - Supabase error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch agent template',
        error: error.message
      });
    }

    const ownsTemplate = data.created_by === userId;
    const isVisible = data.is_public || ownsTemplate || role === 'admin';

    if (!isVisible) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this template'
      });
    }

    return res.json({
      success: true,
      data: {
        template: data
      }
    });
  } catch (error) {
    console.error('getAgentTemplateById - Unexpected error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const updateAgentTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const {
      name,
      description,
      prompt,
      smsPrompt,
      firstMessage,
      calEventTypeSlug,
      calEventTypeId,
      calTimezone,
      knowledgeBaseId,
      isPublic,
      category,
      tags
    } = req.body;

    const slugName = req.user.slugName;

    // Only main admin can update templates (whitelabel admins have slugName)
    if (slugName && slugName !== 'main' && slugName.trim() !== '') {
      return res.status(403).json({
        success: false,
        message: 'Only main admin can update templates. Whitelabel admins do not have access to this feature.'
      });
    }

    const { data: existingTemplate, error: fetchError } = await supabase
      .from('agent_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'Agent template not found'
        });
      }

      console.error('updateAgentTemplate - fetch error:', fetchError);
      return res.status(500).json({
        success: false,
        message: 'Failed to load agent template',
        error: fetchError.message
      });
    }

    const updatePayload = {
      updated_at: new Date().toISOString()
    };

    if (name !== undefined) updatePayload.name = normalizeString(name);
    if (description !== undefined) updatePayload.description = normalizeString(description);
    if (prompt !== undefined) updatePayload.prompt = normalizeString(prompt);
    if (smsPrompt !== undefined) updatePayload.sms_prompt = normalizeString(smsPrompt) || null;
    if (firstMessage !== undefined) updatePayload.first_message = normalizeString(firstMessage) || null;
    if (calEventTypeSlug !== undefined) updatePayload.cal_event_type_slug = normalizeString(calEventTypeSlug) || null;
    if (calEventTypeId !== undefined) updatePayload.cal_event_type_id = normalizeString(calEventTypeId) || null;
    if (calTimezone !== undefined) updatePayload.cal_timezone = normalizeString(calTimezone) || 'UTC';
    if (knowledgeBaseId !== undefined) updatePayload.knowledge_base_id = knowledgeBaseId || null;
    if (isPublic !== undefined) updatePayload.is_public = Boolean(isPublic);
    if (category !== undefined) updatePayload.category = normalizeString(category) || null;
    if (tags !== undefined) updatePayload.tags = normalizeTags(tags);

    const { data, error } = await supabase
      .from('agent_templates')
      .update(updatePayload)
      .eq('id', templateId)
      .select()
      .single();

    if (error) {
      console.error('updateAgentTemplate - Supabase error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update agent template',
        error: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Agent template updated successfully',
      data: {
        template: data
      }
    });
  } catch (error) {
    console.error('updateAgentTemplate - Unexpected error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const deleteAgentTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const slugName = req.user.slugName;

    // Only main admin can delete templates (whitelabel admins have slugName)
    if (slugName && slugName !== 'main' && slugName.trim() !== '') {
      return res.status(403).json({
        success: false,
        message: 'Only main admin can delete templates. Whitelabel admins do not have access to this feature.'
      });
    }

    const { error } = await supabase
      .from('agent_templates')
      .delete()
      .eq('id', templateId);

    if (error) {
      console.error('deleteAgentTemplate - Supabase error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete agent template',
        error: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Agent template deleted successfully'
    });
  } catch (error) {
    console.error('deleteAgentTemplate - Unexpected error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const createAgentFromTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const {
      name,
      description,
      prompt,
      smsPrompt,
      firstMessage,
      calEventTypeSlug,
      calEventTypeId,
      calTimezone,
      knowledgeBaseId
    } = req.body || {};

    const userId = req.user.userId;
    const role = req.user.role;

    const { data: template, error: templateError } = await supabase
      .from('agent_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError) {
      if (templateError.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'Agent template not found'
        });
      }

      console.error('createAgentFromTemplate - fetch error:', templateError);
      return res.status(500).json({
        success: false,
        message: 'Failed to load agent template',
        error: templateError.message
      });
    }

    const ownsTemplate = template.created_by === userId;
    const canUseTemplate = template.is_public || ownsTemplate || role === 'admin';

    if (!canUseTemplate) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this template'
      });
    }

    const finalName = normalizeString(name) || template.name;
    const finalDescription = normalizeString(description) || template.description;
    const finalPrompt = normalizeString(prompt) || template.prompt;

    if (!finalName || !finalDescription || !finalPrompt) {
      return res.status(400).json({
        success: false,
        message: 'Name, description, and prompt are required.'
      });
    }

    const agentPayload = {
      name: finalName,
      description: finalDescription,
      prompt: finalPrompt,
      sms_prompt: normalizeString(smsPrompt) || template.sms_prompt || null,
      first_message: normalizeString(firstMessage) || template.first_message || null,
      user_id: userId,
      cal_api_key: null,
      cal_event_type_slug: normalizeString(calEventTypeSlug) || template.cal_event_type_slug || null,
      cal_event_type_id: normalizeString(calEventTypeId) || template.cal_event_type_id || null,
      cal_timezone: normalizeString(calTimezone) || template.cal_timezone || 'UTC',
      cal_enabled: false,
      knowledge_base_id: knowledgeBaseId || template.knowledge_base_id || null,
      template_id: template.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('agents')
      .insert([agentPayload])
      .select()
      .single();

    if (error) {
      console.error('createAgentFromTemplate - Supabase error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create agent from template',
        error: error.message
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Agent created from template successfully',
      data: {
        agent: data
      }
    });
  } catch (error) {
    console.error('createAgentFromTemplate - Unexpected error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

