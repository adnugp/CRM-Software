import nodemailer from 'nodemailer';
import cron from 'node-cron';
import moment from 'moment';

/**
 * Notification Service for CRM System
 * Handles scheduled email alerts for overdue payments, expiring registrations, and deadlines.
 */
export default function setupNotificationService(db, queryFirebaseData) {
    // Initialize nodemailer transporter
    // These should be set in .env
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    const sendAlertEmails = async () => {
        console.log('🚀 Starting daily alert check...');

        try {
            const today = moment().startOf('day');
            const alerts = [];

            // 1. Check for Overdue Payments
            const payments = await queryFirebaseData('payments');
            const overduePayments = payments.filter(p => p.status === 'pending' && moment(p.dueDate).isBefore(today));
            for (const p of overduePayments) {
                alerts.push(`🚨 [OVERDUE PAYMENT] ${p.description} (Amount: $${p.amount}) was due on ${p.dueDate}`);
            }

            // 2. Check for Expiring Registrations (within 30 days)
            const registrations = await queryFirebaseData('registrations');
            const expiringRegistrations = registrations.filter(r => {
                const expiryDate = moment(r.expiryDate);
                return r.status !== 'expired' && expiryDate.isBefore(today.clone().add(30, 'days'));
            });
            for (const r of expiringRegistrations) {
                const daysLeft = moment(r.expiryDate).diff(today, 'days');
                const status = daysLeft < 0 ? 'HAS EXPIRED' : `expires in ${daysLeft} days`;
                alerts.push(`📋 [REGISTRATION ALERT] ${r.name} (${r.company}) ${status} on ${r.expiryDate}`);
            }

            // 3. Check for Project Deadlines (within 14 days)
            const projects = await queryFirebaseData('projects');
            const approachingProjects = projects.filter(p => {
                const deadline = moment(p.deadline);
                return ['running', 'in-progress'].includes(p.status) && deadline.isBefore(today.clone().add(14, 'days'));
            });
            for (const p of approachingProjects) {
                const daysLeft = moment(p.deadline).diff(today, 'days');
                const status = daysLeft < 0 ? 'IS OVERDUE' : `is due in ${daysLeft} days`;
                alerts.push(`🏗️ [PROJECT DEADLINE] ${p.name} (${p.company}) ${status} (${p.deadline})`);
            }

            // 4. Check for Tender Deadlines (within 14 days)
            const tenders = await queryFirebaseData('tenders');
            const approachingTenders = tenders.filter(t => {
                const deadline = moment(t.deadline);
                return t.status === 'running' && deadline.isBefore(today.clone().add(14, 'days'));
            });
            for (const t of approachingTenders) {
                const daysLeft = moment(t.deadline).diff(today, 'days');
                const status = daysLeft < 0 ? 'DEADLINE PASSED' : `deadline in ${daysLeft} days`;
                alerts.push(`📄 [TENDER DEADLINE] ${t.name} (${t.company}) ${status} (${t.deadline})`);
            }

            console.log(`📊 Alert Stats: ${overduePayments.length} Overdue Payments, ${expiringRegistrations.length} Expiring Regs, ${approachingProjects.length} Projects, ${approachingTenders.length} Tenders`);
            
            if (alerts.length > 0) {
                console.log(`Found ${alerts.length} critical alerts. Sending email...`);

                // Get recipients (Target all Managers and Admins automatically)
                const employees = await queryFirebaseData('employees');
                const users = await queryFirebaseData('users');

                // Combine both employees with manager positions and users with manager/admin roles
                const admins = employees.filter(e => 
                    e.status === 'active' && 
                    (e.position?.toLowerCase().includes('manager') || 
                     e.position?.toLowerCase().includes('admin'))
                );

                const managers = users.filter(u => 
                    u.role === 'admin' || 
                    u.role === 'user' // 'user' is the 'Manager' role in the registration UI
                );

                const uniqueEmails = new Set();
                
                // Always add the primary alert recipient from .env if it exists
                if (process.env.ALERT_RECIPIENT) {
                    uniqueEmails.add(process.env.ALERT_RECIPIENT.toLowerCase());
                }

                // Add admins and managers from database
                admins.forEach(a => { if (a.email) uniqueEmails.add(a.email.toLowerCase()); });
                managers.forEach(m => { if (m.email) uniqueEmails.add(m.email.toLowerCase()); });

                console.log(`👥 Recipients: ${admins.length} admins, ${managers.length} managers. Primary: ${process.env.ALERT_RECIPIENT || 'None'}`);
                
                const recipients = uniqueEmails.size > 0
                    ? Array.from(uniqueEmails).join(', ')
                    : 'admin@gptechnologies.ae';

                console.log(`📧 Final recipient list: ${recipients}`);

                const mailOptions = {
                    from: `"CRM Alerts" <${process.env.SMTP_USER}>`,
                    to: recipients,
                    subject: `CRM Alerts: ${alerts.length} Items Require Attention`,
                    text: `You have ${alerts.length} critical items in the CRM that require attention:\n\n` + alerts.join('\n\n') + `\n\nLogin to the dashboard to take action: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`,
                    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
              <h2 style="color: #d32f2f;">CRM Critical Alerts</h2>
              <p>Hello Team,</p>
              <p>The following items in your CRM system have reached a critical status or upcoming deadline:</p>
              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; border-left: 4px solid #d32f2f;">
                ${alerts.map(a => `<p style="margin: 10px 0; border-bottom: 1px solid #eee; padding-bottom: 5px;">${a}</p>`).join('')}
              </div>
              <p style="margin-top: 20px;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" 
                   style="background-color: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Go to CRM Dashboard
                </a>
              </p>
              <p style="font-size: 12px; color: #777; margin-top: 30px;">
                This is an automated message from your IT GROW PLUS TECHNOLOGIES CRM System.
              </p>
            </div>
          `
                };

                if (process.env.SMTP_USER && process.env.SMTP_PASS) {
                    await transporter.sendMail(mailOptions);
                    console.log('✅ Alert email sent to:', recipients);
                } else {
                    console.warn('⚠️ SMTP credentials not configured. Email NOT sent.');
                    console.log('--- EMAIL CONTENT PREVIEW ---');
                    console.log(mailOptions.text);
                    console.log('------------------------------');
                }
            } else {
                console.log('✅ No critical alerts found today.');
            }
        } catch (error) {
            console.error('❌ Error in notification service:', error);
        }
    };

    // Schedule the task (Default: Every day at 9:00 AM)
    // Cron expression: minute hour day-of-month month day-of-week
    const schedule = process.env.ALERT_SCHEDULE || '0 9 * * *';
    cron.schedule(schedule, sendAlertEmails);

    console.log(`📡 Notification service scheduled with: "${schedule}"`);

    // Optionally run once on startup for debugging (if enabled)
    if (process.env.RUN_ALERTS_ON_STARTUP === 'true') {
        sendAlertEmails();
    }
}
