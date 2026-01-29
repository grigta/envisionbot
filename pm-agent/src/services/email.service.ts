/**
 * Email Service
 * Sends notification emails using nodemailer
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { NotificationPriority } from "../types.js";

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export interface EmailNotification {
  to: string;
  subject: string;
  body: string;
  priority?: NotificationPriority;
}

export class EmailService {
  private transporter: Transporter | null = null;
  private config: EmailConfig | null = null;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize email service from environment variables
   */
  private initialize(): void {
    const host = process.env.EMAIL_HOST;
    const port = process.env.EMAIL_PORT;
    const secure = process.env.EMAIL_SECURE === "true";
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    const from = process.env.EMAIL_FROM;

    if (!host || !port || !user || !pass || !from) {
      console.log("Email service not configured. Email notifications will be disabled.");
      return;
    }

    this.config = {
      host,
      port: parseInt(port, 10),
      secure,
      user,
      pass,
      from,
    };

    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.user,
        pass: this.config.pass,
      },
    });

    console.log("Email service initialized successfully");
  }

  /**
   * Check if email service is configured
   */
  isConfigured(): boolean {
    return this.transporter !== null && this.config !== null;
  }

  /**
   * Send email notification
   */
  async sendEmail(notification: EmailNotification): Promise<boolean> {
    if (!this.isConfigured()) {
      console.log("Email service not configured, skipping email");
      return false;
    }

    try {
      const priorityColors: Record<NotificationPriority, string> = {
        low: "#10B981",
        medium: "#F59E0B",
        high: "#EF4444",
        critical: "#DC2626",
      };

      const priorityColor = notification.priority
        ? priorityColors[notification.priority]
        : "#6B7280";

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
                line-height: 1.6;
                color: #1F2937;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                border-radius: 8px 8px 0 0;
              }
              .content {
                background: #ffffff;
                border: 1px solid #E5E7EB;
                border-top: none;
                padding: 24px;
                border-radius: 0 0 8px 8px;
              }
              .priority-badge {
                display: inline-block;
                background: ${priorityColor};
                color: white;
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                margin-top: 8px;
              }
              .footer {
                margin-top: 24px;
                padding-top: 16px;
                border-top: 1px solid #E5E7EB;
                font-size: 12px;
                color: #6B7280;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">Envision CEO</h1>
              ${
                notification.priority
                  ? `<span class="priority-badge">${notification.priority} Priority</span>`
                  : ""
              }
            </div>
            <div class="content">
              <h2 style="margin-top: 0; color: #111827;">${notification.subject}</h2>
              <div style="white-space: pre-wrap; color: #374151;">${notification.body}</div>
            </div>
            <div class="footer">
              <p>This is an automated notification from Envision CEO - Autonomous Project Manager Agent</p>
            </div>
          </body>
        </html>
      `;

      await this.transporter!.sendMail({
        from: this.config!.from,
        to: notification.to,
        subject: notification.subject,
        text: notification.body,
        html,
      });

      console.log(`Email sent successfully to ${notification.to}`);
      return true;
    } catch (error) {
      console.error("Failed to send email:", error);
      return false;
    }
  }

  /**
   * Send a test email
   */
  async sendTestEmail(to: string): Promise<boolean> {
    return this.sendEmail({
      to,
      subject: "Test Email from Envision CEO",
      body: "This is a test email to verify your email notification settings are working correctly.",
      priority: "low",
    });
  }
}

// Singleton instance
export const emailService = new EmailService();
