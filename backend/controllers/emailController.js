import nodemailer from 'nodemailer';
import * as xlsx from 'xlsx';
import { OpenAI } from 'openai';
import { csvService } from '#services/csv-service.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export const verifyCredentials = async (req, res) => {
    try {
        const { host, port, user, pass, secure, fromName } = req.body;
        const userId = req.user.userId;

        const transporter = nodemailer.createTransport({
            host,
            port: parseInt(port),
            secure: secure || false, // true for 465, false for other ports
            auth: {
                user,
                pass,
            },
        });

        await transporter.verify();

        // Save to database if verification successful
        const { error } = await supabase
            .from('user_smtp_credentials')
            .upsert({
                user_id: userId,
                host,
                port: parseInt(port),
                username: user,
                password: pass,
                from_name: fromName,
                updated_at: new Date()
            }, { onConflict: 'user_id' });

        if (error) throw error;

        res.status(200).json({ success: true, message: 'SMTP credentials verified and saved successfully' });
    } catch (error) {
        console.error('SMTP Verification Error:', error);
        res.status(400).json({ success: false, message: 'Failed to verify credentials', error: error.message });
    }
};

export const parseContactFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const fileBuffer = req.file.buffer;
        const fileName = req.file.originalname.toLowerCase();
        let contacts = [];

        if (fileName.endsWith('.csv')) {
            const csvText = fileBuffer.toString('utf-8');
            contacts = csvService.parseCsvContent(csvText);
        } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = xlsx.utils.sheet_to_json(worksheet);

            // Normalize and map fields similar to CSV service
            contacts = jsonData.map(row => {
                const normalized = {};
                Object.keys(row).forEach(key => {
                    normalized[key.toLowerCase().trim()] = row[key];
                });

                return {
                    first_name: normalized.first_name || normalized.firstname || normalized.fname || '',
                    last_name: normalized.last_name || normalized.lastname || normalized.lname || '',
                    email: normalized.email || normalized.email_address || normalized.mail || '',
                    phone: normalized.phone || normalized.mobile || ''
                };
            }).filter(c => c.email && c.email.includes('@')); // Basic validation
        } else {
            return res.status(400).json({ success: false, message: 'Unsupported file format' });
        }

        res.status(200).json({ success: true, count: contacts.length, contacts });
    } catch (error) {
        console.error('File Parse Error:', error);
        res.status(500).json({ success: false, message: 'Failed to parse file', error: error.message });
    }
};

export const generateEmailContent = async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ success: false, message: 'Prompt is required' });
        }

        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: "You are a helpful email marketing assistant. Write professional and engaging email content based on the user's prompt. formatting it with HTML simple tags if needed (like <br>, <b>) but mostly keep it clean text." },
                { role: "user", content: prompt }
            ],
            model: "gpt-3.5-turbo",
        });

        const content = completion.choices[0].message.content;

        res.status(200).json({ success: true, content });
    } catch (error) {
        console.error('AI Generation Error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate content', error: error.message });
    }
};

export const sendBulkEmails = async (req, res) => {
    try {
        const { credentials, contacts, subject, htmlBody } = req.body;

        if (!credentials || !contacts || !Array.isArray(contacts) || !htmlBody) {
            return res.status(400).json({ success: false, message: 'Missing required parameters' });
        }

        const transporter = nodemailer.createTransport({
            host: credentials.host,
            port: parseInt(credentials.port),
            secure: credentials.secure || false,
            auth: {
                user: credentials.user,
                pass: credentials.pass,
            },
            pool: true, // Use pooled connections for better performance
            maxConnections: 5,
            maxMessages: 100,
        });

        // Send in chunks to avoid overwhelming the server or SMTP limit
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        // Simple loop for now - in production, might want a job queue
        for (const contact of contacts) {
            try {
                if (!contact.email) continue;

                // Simple template replacement
                let personalizedBody = htmlBody
                    .replace(/{{first_name}}/g, contact.first_name || '')
                    .replace(/{{last_name}}/g, contact.last_name || '')
                    .replace(/{{email}}/g, contact.email);

                await transporter.sendMail({
                    from: `"${credentials.fromName || credentials.user}" <${credentials.user}>`,
                    to: contact.email,
                    subject: subject,
                    html: personalizedBody,
                });

                results.success++;
            } catch (err) {
                console.error(`Failed to send to ${contact.email}:`, err);
                results.failed++;
                results.errors.push({ email: contact.email, error: err.message });
            }
        }

        transporter.close();

        res.status(200).json({ success: true, results });

    } catch (error) {
        console.error('Bulk Send Error:', error);
        res.status(500).json({ success: false, message: 'Failed to send emails', error: error.message });
    }
};
