import "dotenv/config";
import Twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';
import { createTwilioClient } from './twilioCredentialsService.js';

// Optional Supabase client for persistence
const supa = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

/** Build our public base URL (works locally & behind tunnels) */
function getBase(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/+$/, '');
  const proto = req.protocol || 'http';
  return `${proto}://${req.get('host')}`;
}

/** Twilio demo URL helper (ignore it when deciding "used") */
function isTwilioDemoUrl(url = '') {
  const u = String(url).trim().toLowerCase();
  return u.startsWith('https://demo.twilio.com') || u.startsWith('http://demo.twilio.com');
}

/** PV configured? (treat demo URL as NOT configured) */
function hasProgrammableVoice(n) {
  const hasApp = Boolean(n.voiceApplicationSid);
  const hasRealUrl = Boolean(n.voiceUrl && n.voiceUrl.trim()) && !isTwilioDemoUrl(n.voiceUrl);
  return hasApp || hasRealUrl;
}

/** Is the number unused by our webhook/app? (demo URL is "not ours") */
function isUnusedForOurWebhook(n, base) {
  const ours = !!n.voiceUrl && 
    (n.voiceUrl.startsWith(`${base}/twilio/`) || n.voiceUrl.startsWith(`${base}/api/`));
  return !ours;
}

/** Strict = truly unused: no PV (ignoring demo URL) AND not on a trunk */
function isStrictlyUnused(n) {
  const onTrunk = Boolean(n.trunkSid);
  return !hasProgrammableVoice(n) && !onTrunk;
}

/** Classify usage for UI badges */
function classifyUsage(n, base) {
  if (n.trunkSid) return 'trunk';
  if (n.voiceApplicationSid) return 'app';
  if (n.voiceUrl) {
    if (isTwilioDemoUrl(n.voiceUrl)) return 'demo';
    const ours = n.voiceUrl.startsWith(`${base}/twilio/`) || n.voiceUrl.startsWith(`${base}/api/`);
    return ours ? 'ours' : 'foreign';
  }
  return 'unused';
}

// ------------------- main service functions ---------------------------

export const getPhoneNumbers = async (req) => {
  try {
    const userId = req.user.userId; // Get userId from auth middleware
    const base = getBase(req);
    const unusedOnly = req.query.unused === '1';
    const strict = req.query.strict === '1';

    // Create Twilio client with user's credentials
    const twilio = await createTwilioClient(userId);

    // Optional: numbers you've mapped in your DB
    let mappedSet = new Set();
    if (supa) {
      try {
        const { data } = await supa.from('phone_number').select('number');
        mappedSet = new Set((data || []).map((m) => m.number));
      } catch {
        // ignore if table doesn't exist
      }
    }

    const all = await twilio.incomingPhoneNumbers.list({ limit: 1000 });

    const rows = all.map((n) => {
      const row = {
        sid: n.sid,
        phoneNumber: n.phoneNumber,
        friendlyName: n.friendlyName || '',
        voiceUrl: n.voiceUrl || '',
        voiceApplicationSid: n.voiceApplicationSid || '',
        trunkSid: n.trunkSid || null,
        mapped: mappedSet.has(n.phoneNumber),
      };
      return { ...row, usage: classifyUsage(row, base) }; // 'unused' | 'demo' | 'ours' | 'foreign' | 'app' | 'trunk'
    });

    const filtered = unusedOnly
      ? rows.filter((n) => (strict ? isStrictlyUnused(n) : isUnusedForOurWebhook(n, base)) && !n.mapped)
      : rows;

    return { success: true, numbers: filtered };
  } catch (e) {
    console.error('twilio/phone-numbers error', {
      code: e?.code,
      status: e?.status,
      message: e?.message,
    });
    return { success: false, message: 'Failed to fetch numbers' };
  }
};

// Get phone numbers using user's saved credentials (like sass-livekit pattern)
export const getUserPhoneNumbers = async (req) => {
  try {
    const userId = req.user.userId;
    
    if (!supa) {
      return { success: false, message: 'Database connection not configured' };
    }
    
    // Get user's active credentials
    const { data: credentials, error: credError } = await supa
      .from('user_twilio_credentials')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
    
    if (credError || !credentials) {
      return { success: false, message: 'No Twilio credentials found' };
    }
    
    // Create Twilio client with user's credentials
    const twilio = Twilio(credentials.account_sid, credentials.auth_token);
    
    // Fetch phone numbers from database first
    const { getPhoneNumbers } = await import('./phoneNumberService.js');
    const dbResult = await getPhoneNumbers(userId);
    const dbNumbers = dbResult.success ? dbResult.phoneNumbers : [];
    
    // Create a map of database numbers for quick lookup
    const dbNumberMap = new Map();
    dbNumbers.forEach(dbNum => {
      dbNumberMap.set(dbNum.number, {
        id: dbNum.id,
        inbound_assistant_id: dbNum.inbound_assistant_id,
        status: dbNum.status,
        trunk_sid: dbNum.trunk_sid,
        label: dbNum.label,
        agents: dbNum.agents
      });
    });
    
    // Fetch phone numbers from Twilio
    const all = await twilio.incomingPhoneNumbers.list({ limit: 1000 });
    
    // Classify usage based on user's trunk (like sass-livekit)
    const classifyUsage = (row, userTrunkSid) => {
      const { voiceUrl, voiceApplicationSid, trunkSid } = row;
      
      if (trunkSid === userTrunkSid) return 'ours';
      if (trunkSid) return 'trunk';
      if (voiceApplicationSid) return 'app';
      if (voiceUrl) {
        if (isTwilioDemoUrl(voiceUrl)) return 'demo';
        // Check if it's our webhook URL
        const base = process.env.FRONTEND_URL || 'http://localhost:8080';
        const ours = voiceUrl.startsWith(`${base}/twilio/`) || voiceUrl.startsWith(`${base}/api/`);
        return ours ? 'ours' : 'foreign';
      }
      return 'unused';
    };
    
    const rows = all.map((n) => {
      const dbData = dbNumberMap.get(n.phoneNumber);
      const row = {
        // Database fields
        id: dbData?.id || null,
        phone_sid: n.sid,
        number: n.phoneNumber,
        label: dbData?.label || n.friendlyName || '',
        inbound_assistant_id: dbData?.inbound_assistant_id || null,
        webhook_status: 'configured',
        status: dbData?.status || 'active',
        trunk_sid: dbData?.trunk_sid || n.trunkSid || null,
        user_id: userId,
        created_at: dbData ? new Date().toISOString() : null,
        updated_at: dbData ? new Date().toISOString() : null,
        // Legacy fields for compatibility
        sid: n.sid,
        phoneNumber: n.phoneNumber,
        friendlyName: n.friendlyName || '',
        voiceUrl: n.voiceUrl || '',
        voiceApplicationSid: n.voiceApplicationSid || '',
        trunkSid: dbData?.trunk_sid || n.trunkSid || null,
        mapped: !!dbData?.inbound_assistant_id,
        usage: classifyUsage({
          voiceUrl: n.voiceUrl,
          voiceApplicationSid: n.voiceApplicationSid,
          trunkSid: dbData?.trunk_sid || n.trunkSid
        }, credentials.trunk_sid)
      };
      return row;
    });
    
    // Filter unused numbers if requested
    const unusedOnly = req.query.unused === '1';
    const filtered = unusedOnly
      ? rows.filter((n) => n.usage === 'unused' && !n.mapped)
      : rows;
    
    return { success: true, numbers: filtered };
  } catch (e) {
    console.error('twilio/user-phone-numbers error', e);
    return { success: false, message: 'Failed to fetch phone numbers' };
  }
};

export const assignNumber = async (req) => {
  try {
    const userId = req.user.userId;
    const { phoneSid, assistantId, label } = req.body || {};
    if (!phoneSid || !assistantId) {
      return { success: false, message: 'phoneSid and assistantId are required' };
    }

    // Get user's main trunk from credentials
    if (!supa) {
      return { success: false, message: 'Database connection not configured' };
    }
    
    const { data: credentials, error: credError } = await supa
      .from('user_twilio_credentials')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
    
    if (credError || !credentials?.trunk_sid) {
      return { success: false, message: 'No main trunk found. Please configure Twilio credentials first.' };
    }

    // Create Twilio client with user's credentials
    const twilio = await createTwilioClient(userId);
    const num = await twilio.incomingPhoneNumbers(phoneSid).fetch();

    // Attach phone number to the main trunk instead of setting webhook
    const { attachPhoneToMainTrunk } = await import('./twilioMainTrunkService.js');
    await attachPhoneToMainTrunk({
      twilio,
      phoneSid: num.sid,
      e164Number: num.phoneNumber,
      userId,
      label: label || num.friendlyName || null
    });

    // Use the new phone number service
    const { upsertPhoneNumber } = await import('./phoneNumberService.js');
    const phoneNumberData = {
      phone_sid: num.sid,
      number: num.phoneNumber,
      label: label || num.friendlyName || null,
      inbound_assistant_id: assistantId,
      webhook_status: 'configured',
      status: 'active',
      trunk_sid: credentials.trunk_sid,
    };

    const phoneResult = await upsertPhoneNumber(phoneNumberData, userId);
    if (!phoneResult.success) {
      console.warn('Failed to save phone number mapping:', phoneResult.message);
      // Continue execution - the assignment will still work via LiveKit dispatch rules
    }

    return { 
      success: true, 
      number: { 
        id: phoneResult.phoneNumber?.id,
        sid: num.sid, 
        phoneNumber: num.phoneNumber,
        assistantId: assistantId,
        trunkSid: credentials.trunk_sid
      } 
    };
  } catch (e) {
    console.error('twilio/assign error', e);
    return { success: false, message: 'Assign failed' };
  }
};

export const getTrunks = async (req) => {
  try {
    const userId = req.user.userId;
    // Create Twilio client with user's credentials
    const twilio = await createTwilioClient(userId);
    
    const trunks = await twilio.trunking.v1.trunks.list({ limit: 100 });
    return {
      success: true,
      trunks: trunks.map((t) => ({
        sid: t.sid,
        name: t.friendlyName,
        domainName: t.domainName,
      })),
    };
  } catch (e) {
    console.error('twilio/trunks error', e);
    return { success: false, message: 'Failed to list trunks' };
  }
};

export const attachToTrunk = async (req) => {
  try {
    const userId = req.user.userId;
    const { phoneSid, phoneNumber, label } = req.body || {};

    if (!phoneSid && !phoneNumber) {
      return { success: false, message: 'phoneSid or phoneNumber is required' };
    }

    // Create Twilio client with user's credentials
    const twilio = await createTwilioClient(userId);

    // Use main trunk strategy - attach to user's main trunk
    const { attachPhoneToMainTrunk } = await import('./twilioMainTrunkService.js');

    const { trunkSid, e164 } = await attachPhoneToMainTrunk({
      twilio,
      phoneSid,
      e164Number: phoneNumber,
      userId,
      label,
    });

    return { success: true, attached: { trunkSid, phoneSid: phoneSid || null, number: e164 } };
  } catch (e) {
    console.error('twilio/trunk/attach error', e);
    return { success: false, message: e?.message || 'Attach to main trunk failed' };
  }
};

export const mapNumber = async (req) => {
  try {
    const userId = req.user.userId;
    const { phoneSid, phoneNumber, assistantId, label } = req.body || {};
    if (!assistantId || (!phoneSid && !phoneNumber)) {
      return {
        success: false,
        message: 'assistantId and phoneSid or phoneNumber are required',
      };
    }

    // Create Twilio client with user's credentials
    const twilio = await createTwilioClient(userId);

    // normalize number (fetch from Twilio if only PN SID provided)
    let e164 = phoneNumber;
    if (!e164 && phoneSid) {
      const num = await twilio.incomingPhoneNumbers(phoneSid).fetch();
      e164 = num.phoneNumber;
    }
    if (!e164) return { success: false, message: 'Could not resolve phone number' };

    // Use the new phone number service
    const { upsertPhoneNumber } = await import('./phoneNumberService.js');
    const phoneNumberData = {
      phone_sid: phoneSid || null,
      number: e164,
      label: label || null,
      inbound_assistant_id: assistantId,
      webhook_status: 'configured',
      status: 'active',
    };

    const phoneResult = await upsertPhoneNumber(phoneNumberData, userId);
    if (!phoneResult.success) {
      console.warn('Failed to save phone number mapping:', phoneResult.message);
      // Continue execution - the mapping will still work via LiveKit dispatch rules
    }

    return { 
      success: true, 
      mapped: { 
        id: phoneResult.phoneNumber?.id,
        phoneSid: phoneSid || null, 
        number: e164, 
        assistantId 
      } 
    };
  } catch (e) {
    console.error('twilio/map error', e);
    return { success: false, message: 'Map failed' };
  }
};

export const createTrunk = async (req) => {
  try {
    const userId = req.user.userId;
    const { accountSid, authToken, trunkSid, label } = req.body || {};
    
    if (!accountSid || !authToken || !trunkSid) {
      return { success: false, message: 'accountSid, authToken, and trunkSid are required' };
    }

    // Create Twilio client with the provided credentials
    const twilio = Twilio(accountSid, authToken);

    // For now, we'll just validate the credentials and return success
    // In a real implementation, you might want to create a new trunk or validate the existing one
    try {
      // Test the credentials by making a simple API call
      await twilio.api.accounts(accountSid).fetch();
      
      return {
        success: true,
        message: 'Twilio credentials validated successfully',
        trunk: {
          accountSid,
          trunkSid,
          label: label || 'Custom Trunk'
        }
      };
    } catch (twilioError) {
      return { 
        success: false, 
        message: 'Invalid Twilio credentials: ' + twilioError.message 
      };
    }
  } catch (e) {
    console.error('twilio/create-trunk error', e);
    return { success: false, message: e?.message || 'Create trunk failed' };
  }
};

export const deleteTrunk = async (req) => {
  try {
    const userId = req.user.userId;
    const { trunkSid } = req.params;
    
    if (!trunkSid) {
      return { success: false, message: 'trunkSid is required' };
    }

    // Create Twilio client with user's credentials
    const twilio = await createTwilioClient(userId);

    await twilio.trunking.v1.trunks(trunkSid).remove();

    return { success: true, message: 'Trunk deleted successfully' };
  } catch (e) {
    console.error('twilio/delete-trunk error', e);
    return { success: false, message: e?.message || 'Delete trunk failed' };
  }
};
