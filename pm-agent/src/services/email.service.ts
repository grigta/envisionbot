/**
 * Email Service
 * Handles sending email notifications using nodemailer
 * NOTE: Requires nodemailer package to be installed
 */

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean; // true for 465, false for other ports
  auth: {
    user: string;
    pass: string;
  };
  from: string; // Default from address
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Email service for sending notifications
 * Configure via environment variables:
 * - EMAIL_HOST
 * - EMAIL_PORT
 * - EMAIL_SECURE (true/false)
 * - EMAIL_USER
 * - EMAIL_PASS
 * - EMAIL_FROM
 */
export class EmailService {
  private config: EmailConfig | null = null;
  private transporter: any = null;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize email service from environment variables
   */
  private initialize(): void {
    const host = process.env.EMAIL_HOST;
    const port = process.env.EMAIL_PORT;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    const from = process.env.EMAIL_FROM;

    if (!host || !port || !user || !pass || !from) {
      console.warn(
        "Email service not configured. Set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, and EMAIL_FROM environment variables."
      );
      return;
    }

    this.config = {
      host,
      port: parseInt(port, 10),
      secure: process.env.EMAIL_SECURE === "true",
      auth: { user, pass },
      from,
    };

    // Dynamically import nodemailer only if configured
    this.initializeTransporter();
  }

  /**
   * Initialize nodemailer transporter
   */
  private async initializeTransporter(): Promise<void> {
    if (!this.config) return;

    try {
      // Dynamic import to avoid requiring nodemailer if not configured
      const nodemailer = await import("nodemailer");

      this.transporter = nodemailer.default.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: this.config.auth,
      });

      console.log("Email service initialized successfully");
    } catch (error) {
      console.error("Failed to initialize email service:", error);
      console.warn("Install nodemailer: npm install nodemailer");
      this.transporter = null;
    }
  }

  /**
   * Check if email service is configured and ready
   */
  isConfigured(): boolean {
    return this.config !== null && this.transporter !== null;
  }

  /**
   * Send an email
   */
  async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "Email service not configured",
      };
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.config!.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html || options.text.replace(/\n/g, "<br>"),
      });

      console.log("Email sent:", info.messageId);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to send email:", errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send a notification email with standardized format
   */
  async sendNotificationEmail(
    to: string,
    title: string,
    message: string,
    priority: "low" | "medium" | "high" | "critical"
  ): Promise<{ success: boolean; error?: string }> {
    const priorityEmojis = {
      low: "ℹ️",
      medium: "⚠️",
      high: "🔴",
      critical: "🚨",
    };

    const emoji = priorityEmojis[priority];
    const subject = `${emoji} ${title}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #f4f4f4; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .priority { font-weight: bold; color: ${priority === "critical" ? "#d32f2f" : priority === "high" ? "#f57c00" : priority === "medium" ? "#ffa000" : "#0288d1"}; }
    .message { background-color: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${emoji} ${title}</h2>
      <p class="priority">Priority: ${priority.toUpperCase()}</p>
    </div>
    <div class="message">
      ${message.replace(/\n/g, "<br>")}
    </div>
    <div class="footer">
      <p>This is an automated notification from Envision CEO Project Manager.</p>
      <p>To manage your notification preferences, visit your dashboard settings.</p>
    </div>
  </div>
</body>
</html>
    `;

    return this.sendEmail({
      to,
      subject,
      text: message,
      html,
    });
  }
}
