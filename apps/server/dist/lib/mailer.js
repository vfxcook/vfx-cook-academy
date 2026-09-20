import nodemailer from 'nodemailer';
import { env } from './env.js';
let cached = null;
function transport() {
    if (!env.smtp.enabled)
        return null;
    if (!cached) {
        cached = nodemailer.createTransport({
            host: env.smtp.host,
            port: env.smtp.port,
            secure: env.smtp.port === 465,
            auth: { user: env.smtp.user, pass: env.smtp.pass }
        });
    }
    return cached;
}
async function send(to, subject, text) {
    const mailer = transport();
    if (!mailer) {
        console.warn(`[academy] SMTP not configured — email to ${to} skipped: ${subject}`);
        return false;
    }
    await mailer.sendMail({ from: env.smtp.from, to, subject, text });
    return true;
}
export function sendLicenseEmail(params) {
    return send(params.to, `Your course license code — ${params.courseTitle}`, [
        'Thanks for your payment.',
        '',
        `Course: ${params.courseTitle}`,
        `One-time license code: ${params.licenseCode}`,
        '',
        'Enter this code on your dashboard to unlock the course.',
        '',
        '— VFX Cook Academy'
    ].join('\n'));
}
export function sendLoginLinkEmail(params) {
    return send(params.to, 'Your VFX Cook Academy sign-in link', [
        'Use the link below to sign in. It expires in 15 minutes.',
        '',
        params.url,
        '',
        'If you did not request this, you can ignore this email.',
        '',
        '— VFX Cook Academy'
    ].join('\n'));
}
export function sendGiftEmail(params) {
    return send(params.to, `You have been gifted ${params.courseTitle}`, [
        `Someone gifted you a seat in ${params.courseTitle}.`,
        '',
        `Gift code: ${params.code}`,
        `Redeem here: ${params.url}`,
        '',
        '— VFX Cook Academy'
    ].join('\n'));
}
//# sourceMappingURL=mailer.js.map