import path from 'path';
import { supabase } from '#lib/supabase.js';
import { normalizeSlug, validateSlug } from '#utils/whitelabel.js';

const WEBSITE_FIELDS = [
  'slug_name',
  'custom_domain',
  'website_name',
  'logo',
  'contact_email',
  'meta_description',
  'live_demo_agent_id',
  'live_demo_phone_number',
  'policy_text',
  'landing_category'
];

const DEFAULT_SETTINGS = {
  slug_name: null,
  custom_domain: null,
  website_name: null,
  logo: null,
  contact_email: null,
  meta_description: null,
  live_demo_agent_id: null,
  live_demo_phone_number: null,
  policy_text: null,
  landing_category: null
};

export const checkSlugAvailability = async (req, res) => {
  try {
    const { slug } = req.body;

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: 'Slug is required'
      });
    }

    const validation = validateSlug(slug);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message
      });
    }

    const lowerSlug = validation.slug;

    const { data: existingUser, error } = await supabase
      .from('users')
      .select('slug_name')
      .eq('slug_name', lowerSlug)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking slug availability:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking slug availability'
      });
    }

    if (existingUser) {
      return res.status(200).json({
        success: false,
        message: `${slug} is already taken`
      });
    }

    return res.status(200).json({
      success: true,
      message: `${slug} is available`
    });
  } catch (error) {
    console.error('checkSlugAvailability error:', error);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred'
    });
  }
};

const mapWebsiteSettings = (settings = DEFAULT_SETTINGS) => ({
  slug: settings.slug_name,
  customDomain: settings.custom_domain,
  websiteName: settings.website_name,
  logo: settings.logo,
  contactEmail: settings.contact_email,
  metaDescription: settings.meta_description,
  liveDemoAgentId: settings.live_demo_agent_id,
  liveDemoPhoneNumber: settings.live_demo_phone_number,
  policyText: settings.policy_text,
  landingCategory: settings.landing_category,
  landing_category: settings.landing_category
});

export const getWebsiteSettings = async (req, res) => {
  try {
    const tenant = normalizeSlug(req.tenant || 'main') || 'main';

    if (tenant === 'main' && !req.user) {
      return res.status(200).json({
        success: true,
        settings: mapWebsiteSettings(DEFAULT_SETTINGS)
      });
    }

    let query = supabase.from('users').select(WEBSITE_FIELDS.join(', ')).limit(1);

    if (tenant === 'main') {
      query = query.eq('id', req.user.userId);
    } else {
      query = query.eq('slug_name', tenant);
    }

    const { data, error } = await query.maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching website settings:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching website settings'
      });
    }

    if (!data) {
      return res.status(200).json({
        success: true,
        settings: mapWebsiteSettings(DEFAULT_SETTINGS)
      });
    }

    return res.status(200).json({
      success: true,
      settings: mapWebsiteSettings(data)
    });
  } catch (error) {
    console.error('getWebsiteSettings error:', error);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred'
    });
  }
};

export const updateWebsiteSettings = async (req, res) => {
  try {
    const currentTenant = req.user?.slugName || req.user?.tenant || 'main';

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (currentTenant === 'main' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can update main tenant settings'
      });
    }

    const {
      websiteName,
      customDomain,
      logo,
      contactEmail,
      metaDescription,
      liveDemoAgentId,
      liveDemoPhoneNumber,
      policyText,
      landingCategory
    } = req.body;

    const updatePayload = {
      website_name: websiteName ?? null,
      custom_domain: customDomain ?? null,
      logo: logo ?? null,
      contact_email: contactEmail ?? null,
      meta_description: metaDescription ?? null,
      live_demo_agent_id: liveDemoAgentId ?? null,
      live_demo_phone_number: liveDemoPhoneNumber ?? null,
      policy_text: policyText ?? null,
      landing_category: landingCategory ?? null,
      updated_at: new Date().toISOString()
    };

    let query = supabase.from('users').update(updatePayload);

    if (currentTenant === 'main') {
      query = query.eq('id', req.user.userId);
    } else {
      query = query.eq('slug_name', currentTenant);
    }

    const { data, error } = await query.select(WEBSITE_FIELDS.join(', ')).maybeSingle();

    if (error) {
      console.error('Error updating website settings:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update website settings'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Website settings updated successfully',
      settings: mapWebsiteSettings(data || DEFAULT_SETTINGS)
    });
  } catch (error) {
    console.error('updateWebsiteSettings error:', error);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred'
    });
  }
};

export const uploadTenantLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Logo file is required'
      });
    }

    const relativePath = path.relative(process.cwd(), req.file.path).replace(/\\/g, '/');
    const baseUrl = process.env.PUBLIC_BACKEND_URL || `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/${relativePath}`;

    return res.status(200).json({
      success: true,
      message: 'Logo uploaded successfully',
      data: {
        url,
        path: `/${relativePath}`
      }
    });
  } catch (error) {
    console.error('uploadTenantLogo error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload logo'
    });
  }
};

