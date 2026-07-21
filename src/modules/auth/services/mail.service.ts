import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<number>('SMTP_PORT', 1025);

    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: false,
        auth:
          this.config.get('SMTP_USER') && this.config.get('SMTP_PASS')
            ? {
                user: this.config.get<string>('SMTP_USER'),
                pass: this.config.get<string>('SMTP_PASS'),
              }
            : undefined,
      });
    }
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const link = `${frontendUrl}/verify-email?token=${token}`;
    await this.send(
      to,
      'Verify your FlowPilot email',
      `Welcome to FlowPilot!\n\nVerify your email:\n${link}\n\nThis link expires in 24 hours.`,
    );
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const link = `${frontendUrl}/reset-password?token=${token}`;
    await this.send(
      to,
      'Reset your FlowPilot password',
      `Reset your password:\n${link}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.`,
    );
  }

  private async send(to: string, subject: string, text: string): Promise<void> {
    const from = this.config.get<string>(
      'MAIL_FROM',
      'FlowPilot <noreply@flowpilot.local>',
    );

    if (!this.transporter) {
      this.logger.log(`[dev-mail] To: ${to} | ${subject}\n${text}`);
      return;
    }

    try {
      await this.transporter.sendMail({ from, to, subject, text });
    } catch (error) {
      this.logger.warn(
        `SMTP failed, logging email instead: ${(error as Error).message}`,
      );
      this.logger.log(`[dev-mail] To: ${to} | ${subject}\n${text}`);
    }
  }
}
