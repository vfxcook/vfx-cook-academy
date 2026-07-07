import nodemailer from "nodemailer";

export async function sendLicenseEmail(params: {
  to: string;
  courseTitle: string;
  licenseCode: string;
}) {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM;

  if (!host || !port || !user || !pass || !from) {
    console.warn("SMTP env vars are missing. License email skipped.");
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to: params.to,
    subject: `Your course license code - ${params.courseTitle}`,
    text: `Thanks for your payment.\n\nCourse: ${params.courseTitle}\nOne-time license code: ${params.licenseCode}\n\nUse this code on the dashboard to unlock your paid course.`,
  });
}
