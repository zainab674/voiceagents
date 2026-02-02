import { supabase } from '#lib/supabase.js';

export const getSystemSettings = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('system_settings')
            .select('*')
            .order('key');

        if (error) {
            console.warn('⚠️ system_settings table might be missing or inaccessible:', error.message);
            // Return empty settings so frontend can fall back to defaults
            return res.json({
                success: true,
                settings: []
            });
        }


        // Mask secret values unless user is admin
        // Note: Even for admins, we might want to mask them in the UI, 
        // but the API should return them if needed for editing.
        // For security, we'll return masked values by default and 
        // a separate flag for each setting.
        // Only main admins session
        const isMainAdmin = req.user?.role === 'admin' && (!req.user?.slugName || req.user?.slugName === 'main');

        if (!isMainAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized: Main admin access required'
            });
        }


        const settings = data.map(setting => ({
            key: setting.key,
            value: setting.is_secret ? '********' : setting.value,
            description: setting.description,

            isSecret: setting.is_secret,
            updatedAt: setting.updated_at
        }));

        res.json({
            success: true,
            settings
        });
    } catch (error) {
        console.error('❌ Error fetching system settings:', error.message || error);

        res.status(500).json({
            success: false,
            message: 'Failed to fetch system settings'
        });
    }
};

export const updateSystemSetting = async (req, res) => {
    try {
        const { key, value } = req.body;

        if (!key) {
            return res.status(400).json({
                success: false,
                message: 'Setting key is required'
            });
        }

        // Only main admins can update system settings
        const isMainAdmin = req.user?.role === 'admin' && (!req.user?.slugName || req.user?.slugName === 'main');
        if (!isMainAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized: Main admin access required'
            });
        }


        const { data, error } = await supabase
            .from('system_settings')
            .upsert({
                key,
                value,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' })
            .select()
            .single();


        if (error) throw error;

        res.json({
            success: true,
            message: `Setting ${key} updated successfully`,
            setting: data
        });
    } catch (error) {
        console.error('❌ Error updating system setting:', error.message || error);

        res.status(500).json({
            success: false,
            message: 'Failed to update system setting'
        });
    }
};

export const updateMultipleSettings = async (req, res) => {
    try {
        const { settings } = req.body; // Array of { key, value }

        if (!Array.isArray(settings)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid settings format'
            });
        }

        // Only main admins can update system settings
        const isMainAdmin = req.user?.role === 'admin' && (!req.user?.slugName || req.user?.slugName === 'main');
        if (!isMainAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized: Main admin access required'
            });
        }


        const results = [];
        for (const setting of settings) {
            const { key, value } = setting;
            const { data, error } = await supabase
                .from('system_settings')
                .upsert({
                    key,
                    value,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' })
                .select()
                .single();


            if (!error) {
                results.push(data);
            }
        }

        res.json({
            success: true,
            message: 'Settings updated successfully',
            updatedCount: results.length
        });
    } catch (error) {
        console.error('❌ Error updating multiple system settings:', error.message || error);

        res.status(500).json({
            success: false,
            message: 'Failed to update system settings'
        });
    }
};
