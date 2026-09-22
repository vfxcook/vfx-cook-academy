import nodemailer, { type Transporter } from 'nodemailer';
import { env } from './env.js';

let cached: Transporter | null = null;

function transport() {
  if (!env.smtp.enabled) return null;
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

async function send(to: string, subject: string, text: string) {
  const mailer = transport();
  if (!mailer) {
    console.warn(`[academy] SMTP not configured — email to ${to} skipped: ${subject}`);
    return false;
  }
  await mailer.sendMail({ from: env.smtp.from, to, subject, text });
  return true;
}

export function sendLicenseEmail(params: { to: string; courseTitle: string; licenseCode: string }) {
  return send(
    params.to,
    `Your course license code — ${params.courseTitle}`,
    [
      'Thanks for your payment.',
      '',
      `Course: ${params.courseTitle}`,
      `One-time license code: ${params.licenseCode}`,
      '',
      'Enter this code on your dashboard to unlock the course.',
      '',
      '— BrahmAstra Academy'
    ].join('\n')
  );
}

export function sendLoginLinkEmail(params: { to: string; url: string }) {
  return send(
    params.to,
    'Your BrahmAstra Academy sign-in link',
    [
      'Use the link below to sign in. It expires in 15 minutes.',
      '',
      params.url,
      '',
      'If you did not request this, you can ignore this email.',
      '',
      '— BrahmAstra Academy'
    ].join('\n')
  );
}

export function sendGiftEmail(params: { to: string; courseTitle: string; code: string; url: string }) {
  return send(
    params.to,
    `You have been gifted ${params.courseTitle}`,
    [
      `Someone gifted you a seat in ${params.courseTitle}.`,
      '',
      `Gift code: ${params.code}`,
      `Redeem here: ${params.url}`,
      '',
      '— BrahmAstra Academy'
    ].join('\n')
  );
}
