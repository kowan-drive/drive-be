import { readFileSync } from 'fs';
import Handlebars from 'handlebars';
import { createTransport } from 'nodemailer';
import { join } from 'path';
import { ENV } from '../env';

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  data: Record<string, any> = {},
) {
  const transporter = createTransport({
    host: 'smtp.zoho.com',
    secure: true,
    port: 465,
    auth: {
      user: ENV.SMTP_USER,
      pass: ENV.SMTP_PASSWORD,
    },
  });

  // Import text from ./template.hbs
  const templatePath = join(__dirname, 'register-template.hbs');
  const templateContent = readFileSync(templatePath, 'utf-8');

  const template = Handlebars.compile(templateContent);

  const templateData = {
    ...data,
    year: new Date().getFullYear(),
    companyName: 'Fiscal Career Week',
    dashboardUrl: 'https://fiscalcareerweek.com/dashboard',
  };

  const html = template(templateData);

  const mailOptions = {
    from: `"No Reply" <mailer@fiscalcareerweek.com>`,
    to,
    subject,
    text,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}
