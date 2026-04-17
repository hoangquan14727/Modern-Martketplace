const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
let transporter = null;
const initializeTransporter = () => {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false, 
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
  return transporter;
};
const EmailService = {
  sendPasswordResetEmail: async (email, firstName, resetToken, resetLink) => {
    try {
      const transporter = initializeTransporter();
      const templatePath = path.join(__dirname, '../templates/resetPasswordEmail.html');
      let htmlContent = fs.readFileSync(templatePath, 'utf-8');
      htmlContent = htmlContent
        .replace('{USER_NAME}', firstName || 'User')
        .replace('{RESET_LINK}', resetLink)
        .replace('{TOKEN_EXPIRY}', '15 minutes');
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: email,
        subject: 'Reset Your MARIQ Password',
        html: htmlContent,
        text: `Click here to reset your password: ${resetLink}\n\nThis link expires in 15 minutes.`
      };
      const result = await transporter.sendMail(mailOptions);
      console.log('Password reset email sent to:', email);
      return result;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  },
  verifyConnection: async () => {
    try {
      const transporter = initializeTransporter();
      await transporter.verify();
      console.log('Email service connected successfully');
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      throw error;
    }
  }
};
module.exports = EmailService;
