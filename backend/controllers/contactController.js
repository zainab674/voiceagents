import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const createContactMessage = async (req, res) => {
    try {
        const { subject, description, email } = req.body;
        const userId = req.user?.userId;

        if (!subject || !description) {
            return res.status(400).json({
                success: false,
                message: 'Subject and description are required'
            });
        }

        const { data, error } = await supabase
            .from('contact_messages')
            .insert([
                {
                    user_id: userId,
                    email,
                    subject,
                    description,
                    status: 'pending'
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Error creating contact message:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to save contact message',
                error: error.message
            });
        }

        res.status(201).json({
            success: true,
            message: 'Contact message sent successfully',
            data
        });
    } catch (error) {
        console.error('Contact controller error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

export const getAllContactMessages = async (req, res) => {
    try {
        // Use explicit join syntax and better error handling
        const { data, error } = await supabase
            .from('contact_messages')
            .select(`
                id,
                user_id,
                email,
                subject,
                description,
                status,
                created_at,
                updated_at,
                user:user_id (
                    id,
                    email,
                    first_name,
                    last_name
                )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Database error fetching contact messages:', error);

            // If the join fails, try fetching without the join as a fallback
            if (error.message.includes('relationship')) {
                const { data: simpleData, error: simpleError } = await supabase
                    .from('contact_messages')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (!simpleError) {
                    return res.status(200).json({
                        success: true,
                        data: simpleData.map(m => ({ ...m, user: null })),
                        warning: 'Relational data currently unavailable'
                    });
                }
            }

            return res.status(500).json({
                success: false,
                message: 'Failed to fetch contact messages',
                error: error.message
            });
        }

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Contact controller error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

export const updateContactMessageStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required'
            });
        }

        const { data, error } = await supabase
            .from('contact_messages')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating contact message:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update contact message',
                error: error.message
            });
        }

        res.status(200).json({
            success: true,
            message: 'Contact message updated successfully',
            data
        });
    } catch (error) {
        console.error('Contact controller error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};
