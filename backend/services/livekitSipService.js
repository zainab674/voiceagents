import "dotenv/config";
import crypto from "crypto";
import { SipClient } from "livekit-server-sdk";
import { createClient } from '@supabase/supabase-js';

// Initialize LiveKit SIP client
const lk = new SipClient(
  process.env.LIVEKIT_HOST,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET,
);

// Optional Supabase client for dynamic assistant resolution
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supa = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// ------------------- logging helpers -------------------
const START = Date.now();
const red = (s) => (s ? `${String(s).slice(0, 4)}…redacted` : 'not-set');
const ts = () => new Date().toISOString();
const rid = () => Math.random().toString(36).slice(2, 10);

function log(ctx, msg, extra = {}) {
  const base = { t: ts(), rid: ctx.rid, route: ctx.route, ...extra };
  console.log(`[LK-SIP] ${msg} ::`, JSON.stringify(base));
}

function logErr(ctx, msg, err) {
  const extra = { t: ts(), rid: ctx.rid, route: ctx.route, err: err?.message || String(err) };
  console.error(`[LK-SIP][ERR] ${msg} ::`, JSON.stringify(extra));
}

// ------------------- helpers ---------------------------
const toE164 = (n) => {
  if (!n) return n;
  const cleaned = String(n).replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('00')) return `+${cleaned.slice(2)}`;
  return `+${cleaned}`;
};

function readId(obj, ...keys) {
  for (const k of keys) if (obj && obj[k] != null) return obj[k];
  return undefined;
}

function sha256(s) { 
  return crypto.createHash('sha256').update(String(s), 'utf8').digest('hex'); 
}

function preview(s, n = 80) { 
  const str = String(s || ''); 
  return str.length > n ? `${str.slice(0, n)}…` : str; 
}

async function resolveInboundTrunkId(ctx, { trunkId, trunkName }) {
  if (trunkId) { 
    log(ctx, 'resolveInboundTrunkId: using body trunkId', { trunkId }); 
    return trunkId; 
  }

  const trunks = await lk.listSipInboundTrunk();
  log(ctx, 'resolveInboundTrunkId: listed trunks', { count: trunks.length });

  if (trunkName) {
    const found = trunks.find((t) =>
      readId(t, 'name') === trunkName || readId(t, 'sip_trunk_id', 'sipTrunkId', 'id') === trunkName
    );
    if (found) {
      const id = readId(found, 'sip_trunk_id', 'sipTrunkId', 'id');
      log(ctx, 'resolveInboundTrunkId: found by name', { trunkName, id });
      return id;
    }
    const created = await lk.createSipInboundTrunk({ name: trunkName, numbers: [] });
    const id = readId(created, 'sip_trunk_id', 'sipTrunkId', 'id');
    log(ctx, 'resolveInboundTrunkId: created trunk', { trunkName, id });
    return id;
  }

  if (trunks.length === 1) {
    const id = readId(trunks[0], 'sip_trunk_id', 'sipTrunkId', 'id');
    log(ctx, 'resolveInboundTrunkId: single trunk used', { id });
    return id;
  }

  logErr(ctx, 'resolveInboundTrunkId: cannot resolve', new Error('multiple trunks; need trunkId or trunkName'));
  throw new Error('Cannot resolve inbound trunk: pass trunkId or trunkName parameter.');
}

async function ensureNumberOnInboundTrunk(ctx, { trunkId, phoneNumber }) {
  const e164 = toE164(phoneNumber);
  log(ctx, 'ensureNumberOnInboundTrunk: normalized', { input: phoneNumber, e164, trunkId });
  return e164; // no mutation needed in LK for Option B
}

// --- robust deletion helper (handles SDK variations) -----------------------
async function deleteDispatchRule(ctx, id) {
  // Try camelCase first (common)
  try {
    await lk.deleteSipDispatchRule({ sipDispatchRuleId: id });
    log(ctx, 'deleteSipDispatchRule OK (camelCase)', { id });
    return;
  } catch (e1) {
    logErr(ctx, 'delete camelCase failed, trying positional', e1);
  }
  // Try positional (some SDKs allow deleteSipDispatchRule(id))
  try {
    await lk.deleteSipDispatchRule(id);
    log(ctx, 'deleteSipDispatchRule OK (positional)', { id });
    return;
  } catch (e2) {
    logErr(ctx, 'delete positional failed, trying snake_case', e2);
  }
  // Fallback: snake_case (older or generated variants)
  try {
    await lk.deleteSipDispatchRule({ sip_dispatch_rule_id: id });
    log(ctx, 'deleteSipDispatchRule OK (snake_case)', { id });
  } catch (e3) {
    logErr(ctx, 'deleteSipDispatchRule failed after 3 attempts', e3);
    throw e3;
  }
}

async function deleteRulesForNumber(ctx, { phoneNumber }) {
  const all = await lk.listSipDispatchRule();
  const target = toE164(phoneNumber);
  const getNums = (r) => r?.inbound_numbers || r?.inboundNumbers || [];
  let deleted = 0;
  for (const r of all) {
    const nums = getNums(r);
    if (nums.includes(target)) {
      const id = readId(r, 'sip_dispatch_rule_id', 'sipDispatchRuleId', 'id');
      if (id) { await deleteDispatchRule(ctx, id); deleted++; }
    }
  }
  log(ctx, 'deleteRulesForNumber: done', { phoneNumber: target, deleted });
}

function getTrunkIds(r) { return r?.trunk_ids ?? r?.trunkIds ?? []; }
function getInboundNums(r) { return r?.inbound_numbers ?? r?.inboundNumbers ?? []; }
function getAgents(r) { return r?.roomConfig?.agents ?? []; }

async function findRuleCoveringTrunkAndNumber(ctx, trunkId, numE164) {
  const rules = await lk.listSipDispatchRule();
  log(ctx, 'findRuleCoveringTrunkAndNumber: rules listed', { count: rules.length, trunkId, numE164 });
  const hit = rules.find((r) => {
    const trunks = getTrunkIds(r);
    const nums = getInboundNums(r);
    const trunkMatches = trunks.length === 0 || trunks.includes(trunkId);
    const numberMatches = nums.length === 0 || nums.includes(numE164);
    return trunkMatches && numberMatches;
  }) || null;
  if (hit) {
    log(ctx, 'findRuleCoveringTrunkAndNumber: match', {
      ruleId: readId(hit, 'sip_dispatch_rule_id', 'sipDispatchRuleId', 'id'),
      trunks: getTrunkIds(hit),
      numbers: getInboundNums(hit),
      agents: getAgents(hit).length,
    });
  } else {
    log(ctx, 'findRuleCoveringTrunkAndNumber: no match');
  }
  return hit;
}

async function resolveAssistantId(ctx, { phoneNumber, assistantId }) {
  if (assistantId) { 
    log(ctx, 'assistantId: provided', { assistantId }); 
    return assistantId; 
  }
  if (!supa || !phoneNumber) { 
    log(ctx, 'assistantId: no supabase or phoneNumber'); 
    return null; 
  }
  try {
    const { data: mapping, error } = await supa
      .from('phone_number')
      .select('inbound_assistant_id')
      .eq('number', toE164(phoneNumber))
      .single();
    if (error) throw error;
    const id = mapping?.inbound_assistant_id || null;
    log(ctx, 'assistantId: resolved from supabase', { phoneNumber: toE164(phoneNumber), assistantId: id });
    return id;
  } catch (e) {
    logErr(ctx, 'assistantId resolution failed (phone_number table may not exist yet)', e);
    return null;
  }
}

function buildAgentMetadataJson({ agentName, assistantId, forceFirstMessage = true, llm_model, stt_model, tts_model, }) {
  const meta = { agentName, assistantId, forceFirstMessage };
  if (llm_model) meta.llm_model = llm_model;
  if (stt_model) meta.stt_model = stt_model;
  if (tts_model) meta.tts_model = tts_model;
  return JSON.stringify(meta);
}

async function createRuleForNumber(ctx, { trunkId, phoneNumber, agentName, metadata, roomPrefix = 'did-', agentMetadataJson = '', }) {
  const num = toE164(phoneNumber);
  const name = `auto:${agentName}:${num}`;
  const meta = typeof metadata === 'string' ? metadata : JSON.stringify(metadata || { phoneNumber: num, agentName });

  const rule = { type: 'individual', roomPrefix };
  const options = {
    name,
    trunkIds: [trunkId],
    inbound_numbers: [num], // Try snake_case for API compatibility
    inboundNumbers: [num], // Keep camelCase for fallback
    roomConfig: {
      agents: [{ agentName, metadata: agentMetadataJson || '' }],
      metadata: agentMetadataJson || '',
    },
    metadata: meta,
  };

  log(ctx, 'createRuleForNumber: creating', {
    name,
    trunkId,
    inbound_numbers: options.inbound_numbers,
    roomPrefix,
    agentName,
    agentMetaPreview: preview(agentMetadataJson, 120),
  });

  const out = await lk.createSipDispatchRule(rule, options);
  const id = readId(out, 'sip_dispatch_rule_id', 'sipDispatchRuleId', 'id');
  log(ctx, 'createRuleForNumber: created', { ruleId: id });
  return out;
}

// ------------------- main service functions ---------------------------

export const listInboundTrunks = async () => {
  const ctx = { route: 'listInboundTrunks', rid: rid() };
  try {
    const trunks = await lk.listSipInboundTrunk();
    log(ctx, 'listed inbound trunks', { count: trunks.length });
    return { success: true, trunks };
  } catch (e) {
    logErr(ctx, 'list inbound trunks', e);
    return { success: false, message: e?.message || 'Failed' };
  }
};

export const listDispatchRules = async () => {
  const ctx = { route: 'listDispatchRules', rid: rid() };
  try {
    const rules = await lk.listSipDispatchRule();
    log(ctx, 'listed dispatch rules', { count: rules.length });
    return { success: true, rules };
  } catch (e) {
    logErr(ctx, 'list dispatch rules', e);
    return { success: false, message: e?.message || 'Failed' };
  }
};

export const autoAssignNumber = async ({
  phoneNumber,
  agentName: bodyAgentName,
  assistantId,
  llm_model,
  stt_model,
  tts_model,
  replaceCatchAll = true,
  forceReplace = false,
  trunkId,
  trunkName,
  roomPrefix = 'did-',
  extraMetadata = {},
}) => {
  const ctx = { route: 'autoAssignNumber', rid: rid() };
  log(ctx, 'incoming request', { phoneNumber, bodyAgentName, assistantId });

  try {
    const agentName = bodyAgentName || process.env.LK_AGENT_NAME || 'ai';
    if (!phoneNumber || !agentName) {
      logErr(ctx, 'missing required fields', new Error('phoneNumber and agentName required'));
      return {
        success: false,
        message: 'phoneNumber and agentName are required (set LK_AGENT_NAME env or send in body)',
      };
    }

    log(ctx, 'step: resolve trunk');
    const inboundTrunkId = await resolveInboundTrunkId(ctx, { trunkId, trunkName });

    log(ctx, 'step: normalize number');
    const e164 = await ensureNumberOnInboundTrunk(ctx, { trunkId: inboundTrunkId, phoneNumber });

    log(ctx, 'step: resolve assistantId');
    const assistantIdFinal = await resolveAssistantId(ctx, { phoneNumber: e164, assistantId });

    const agentMetadataJson = buildAgentMetadataJson({
      agentName,
      assistantId: assistantIdFinal || null,
      forceFirstMessage: true,
      llm_model, stt_model, tts_model,
    });

    const promptHash = assistantIdFinal ? sha256(assistantIdFinal) : '';

    log(ctx, 'step: check existing rule');
    const existing = await findRuleCoveringTrunkAndNumber(ctx, inboundTrunkId, e164);

    // If there is any rule covering this DID, clean up so we can create a fresh per-DID rule
    if (existing) {
      const exId = readId(existing, 'sip_dispatch_rule_id', 'sipDispatchRuleId', 'id');
      const nums = getInboundNums(existing);
      const isCatchAll = nums.length === 0;

      log(ctx, 'existing rule found (per-DID enforcement path)', {
        existingId: exId,
        isCatchAll,
        coversNumbers: nums,
      });

      if (forceReplace) {
        log(ctx, 'forceReplace=true -> deleting all rules for this DID');
        await deleteRulesForNumber(ctx, { phoneNumber: e164 });
      }

      if (isCatchAll && replaceCatchAll) {
        log(ctx, 'deleting catch-all rule before creating per-DID', { existingId: exId });
        await deleteDispatchRule(ctx, exId);
      }

      if (!isCatchAll && nums.includes(e164)) {
        log(ctx, 'deleting existing per-DID rule for this number to recreate', { existingId: exId, e164 });
        await deleteDispatchRule(ctx, exId);
      }
    }

    // Always create a per-DID rule for this number
    log(ctx, 'step: create rule');
    const ruleMeta = { phoneNumber: e164, agentName, assistantId: assistantIdFinal || null, ...extraMetadata };

    const rule = await createRuleForNumber(ctx, {
      trunkId: inboundTrunkId,
      phoneNumber: e164,
      agentName,
      metadata: ruleMeta,
      roomPrefix,
      agentMetadataJson,
    });

    const sipDispatchRuleId = readId(rule, 'sip_dispatch_rule_id', 'sipDispatchRuleId', 'id');
    log(ctx, 'done: created rule', { sipDispatchRuleId, e164, trunkId: inboundTrunkId, agentName });

    return {
      success: true,
      reused: false,
      trunkId: inboundTrunkId,
      phoneNumber: e164,
      sipDispatchRuleId,
      rule,
      debug: {
        assistantId: assistantIdFinal || null,
        agentMetadataBytes: agentMetadataJson.length,
        metaPreview: preview(agentMetadataJson, 120),
        tokenSha256: promptHash,
        note: 'Created per-DID rule carrying only assistantId; worker should fetch full prompt via /assistant/:id.',
      },
    };
  } catch (e) {
    logErr(ctx, 'auto-assign error', e);
    return { success: false, message: e?.message || 'Auto-assign failed' };
  }
};

export const resolveAssistant = async (assistantId) => {
  const ctx = { route: 'resolveAssistant', rid: rid() };
  if (!supa) {
    logErr(ctx, 'supabase not configured', new Error('no supabase env'));
    return { success: false, message: 'Supabase not configured' };
  }
  try {
    const id = String(assistantId || '').trim();
    if (!id) {
      logErr(ctx, 'assistant id required', new Error('missing id'));
      return { success: false, message: 'assistant id required' };
    }

    const { data: assistant, error } = await supa
      .from('agents')
      .select('id, name, prompt, cal_api_key, cal_event_type_id, cal_timezone')
      .eq('id', id)
      .single();
    if (error) throw error;
    if (!assistant) {
      logErr(ctx, 'assistant not found', new Error(id));
      return { success: false, message: 'assistant not found' };
    }

    const payload = {
      success: true,
      assistant: {
        id: assistant.id,
        name: assistant.name || 'Assistant',
        prompt: assistant.prompt || '',
      },
      cal_api_key: assistant.cal_api_key || undefined,
      cal_event_type_id: assistant.cal_event_type_id || undefined,
      cal_timezone: assistant.cal_timezone || undefined,
    };
    log(ctx, 'assistant resolved', { id, hasPrompt: !!assistant.prompt });
    return payload;
  } catch (e) {
    logErr(ctx, 'assistant resolve error', e);
    return { success: false, message: e?.message || 'resolve failed' };
  }
};

export const createAssistantTrunk = async ({ assistantId, assistantName, phoneNumber }) => {
  const ctx = { route: 'createAssistantTrunk', rid: rid() };
  log(ctx, 'creating assistant trunk', { assistantId, assistantName, phoneNumber });

  try {
    const e164 = toE164(phoneNumber);
    const agentName = process.env.LK_AGENT_NAME || 'ai';
    
    // Create unique, safe trunk name (like SaaS project)
    const trunkName = `ast-${assistantName}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    
    log(ctx, 'creating assistant trunk with positional signature', { trunkName, e164 });

    // ✅ IMPORTANT: Use positional signature (name, numbers, opts) like SaaS project
    const trunk = await lk.createSipInboundTrunk(
      trunkName,
      [e164],                                 // attach the DID(s) directly to the trunk
      {
        metadata: JSON.stringify({
          kind: 'per-assistant-trunk',
          assistantId,
          assistantName,
          phoneNumber: e164,
          createdAt: new Date().toISOString(),
        }),
      }
    );
    
    const trunkId = readId(trunk, 'sip_trunk_id', 'sipTrunkId', 'id');
    log(ctx, 'created assistant trunk', { trunkId, trunkName, numbers: [e164] });

    // Minimal agent metadata; worker fetches full prompt by assistantId if needed
    const agentMetadataJson = JSON.stringify({
      agentName,
      assistantId,
      forceFirstMessage: true,
    });

    // One catch-all rule per trunk: inboundNumbers empty ⇒ applies to all numbers on that trunk
    const rule = await lk.createSipDispatchRule(
      { type: 'individual', roomPrefix: 'assistant-' },
      {
        name: `assistant:${assistantId}:${Date.now()}`,
        trunkIds: [trunkId],
        inbound_numbers: [],          // ensure compatibility (snake_case)
        inboundNumbers: [],           // and camelCase
        roomConfig: {
          agents: [{ agentName, metadata: agentMetadataJson }],
          metadata: agentMetadataJson,
        },
        metadata: JSON.stringify({
          assistantId,
          assistantName,
          trunkId,
          phoneNumber: e164,
        }),
      }
    );

    const ruleId = readId(rule, 'sip_dispatch_rule_id', 'sipDispatchRuleId', 'id');
    log(ctx, 'created catch-all rule for trunk', { ruleId, trunkId });

    return {
      success: true,
      trunk: {
        id: trunkId,
        name: trunkName,
        numbers: [e164]
      },
      rule: {
        id: ruleId,
        name: `assistant:${assistantId}:${Date.now()}`
      },
      phoneNumber: e164,
      assistantId,
      assistantName
    };

  } catch (e) {
    logErr(ctx, 'create assistant trunk failed', e);
    return { success: false, message: e?.message || 'Failed to create assistant trunk' };
  }
};

export const cleanupDispatchRules = async () => {
  const ctx = { route: 'cleanupDispatchRules', rid: rid() };
  log(ctx, 'starting cleanup of dispatch rules');
  
  try {
    const rules = await lk.listSipDispatchRule();
    log(ctx, 'found rules to check', { count: rules.length });
    
    let deletedCount = 0;
    let keptCount = 0;
    const deletedRules = [];
    
    for (const rule of rules) {
      const ruleId = readId(rule, 'sip_dispatch_rule_id', 'sipDispatchRuleId', 'id');
      const ruleName = rule.name || 'unnamed';
      const inboundNums = getInboundNums(rule);
      
      log(ctx, 'checking rule', { ruleId, ruleName, inboundNumsCount: inboundNums.length });
      
      // Check if this rule has inboundNumbers field
      if (inboundNums.length === 0) {
        log(ctx, 'deleting catch-all rule', { ruleId, ruleName });
        try {
          await deleteDispatchRule(ctx, ruleId);
          deletedCount++;
          deletedRules.push({ id: ruleId, name: ruleName });
        } catch (error) {
          logErr(ctx, 'failed to delete rule', error);
        }
      } else {
        log(ctx, 'keeping rule with inboundNumbers', { ruleId, ruleName, inboundNums });
        keptCount++;
      }
    }
    
    log(ctx, 'cleanup complete', { deletedCount, keptCount });
    
    return {
      success: true,
      message: `Cleanup complete. Deleted ${deletedCount} rules, kept ${keptCount} rules.`,
      deletedCount,
      keptCount,
      deletedRules,
    };
    
  } catch (e) {
    logErr(ctx, 'cleanup failed', e);
    return { success: false, message: e?.message || 'Cleanup failed' };
  }
};
