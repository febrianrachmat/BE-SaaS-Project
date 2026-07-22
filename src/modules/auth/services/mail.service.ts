import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    if (!host) return;

    const port = Number(this.config.get('SMTP_PORT') ?? 587);
    const secureEnv = this.config.get<string>('SMTP_SECURE');
    const secure =
      secureEnv !== undefined && secureEnv !== ''
        ? ['1', 'true', 'yes'].includes(secureEnv.toLowerCase())
        : port === 465;
    const requireTlsEnv = this.config.get<string>('SMTP_REQUIRE_TLS');
    const requireTLS =
      requireTlsEnv !== undefined && requireTlsEnv !== ''
        ? ['1', 'true', 'yes'].includes(requireTlsEnv.toLowerCase())
        : port === 587 && !secure;

    const user = this.config.get<string>('SMTP_USER')?.trim();
    const pass = this.config.get<string>('SMTP_PASS');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS,
      auth: user && pass ? { user, pass } : undefined,
    });

    this.logger.log(
      `SMTP ready (${host}:${port}, secure=${secure}, requireTLS=${requireTLS})`,
    );
  }

  isConfigured(): boolean {
    return this.transporter !== null;
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const link = `${this.frontendUrl()}/verify-email?token=${token}`;
    await this.send(
      to,
      'Verify your FlowPilot email',
      `Welcome to FlowPilot!\n\nVerify your email:\n${link}\n\nThis link expires in 24 hours.`,
      this.htmlLayout(
        'Verify your email',
        `<p style="margin:0 0 16px">Welcome to FlowPilot. Confirm your email to finish setting up your account.</p>
         <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Verify email</a></p>
         <p style="margin:0;color:#64748b;font-size:13px">Or paste this link:<br/><span style="word-break:break-all">${link}</span></p>
         <p style="margin:16px 0 0;color:#64748b;font-size:13px">This link expires in 24 hours.</p>`,
      ),
    );
  }

  /** When SMTP is absent, still emit the link for OpsCtrl/runtime logs. */
  logDevVerificationLink(to: string, token: string): void {
    const link = `${this.frontendUrl()}/verify-email?token=${token}`;
    this.logger.log(
      `[dev-mail] To: ${to} | Verify your FlowPilot email\n${link}`,
    );
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const link = `${this.frontendUrl()}/reset-password?token=${token}`;
    await this.send(
      to,
      'Reset your FlowPilot password',
      `Reset your password:\n${link}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.`,
      this.htmlLayout(
        'Reset your password',
        `<p style="margin:0 0 16px">We received a request to reset your FlowPilot password.</p>
         <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Reset password</a></p>
         <p style="margin:0;color:#64748b;font-size:13px">Or paste this link:<br/><span style="word-break:break-all">${link}</span></p>
         <p style="margin:16px 0 0;color:#64748b;font-size:13px">This link expires in 1 hour. If you did not request this, you can ignore this email.</p>`,
      ),
    );
  }

  async sendWorkspaceInviteEmail(
    to: string,
    workspaceName: string,
    token: string,
  ): Promise<void> {
    const link = `${this.frontendUrl()}/invitations/accept?token=${token}`;
    const safeName = this.escapeHtml(workspaceName);
    await this.send(
      to,
      `You're invited to ${workspaceName} on FlowPilot`,
      `You've been invited to join "${workspaceName}" on FlowPilot.\n\nAccept invitation:\n${link}\n\nThis invite expires in 7 days.`,
      this.htmlLayout(
        `Join ${safeName}`,
        `<p style="margin:0 0 16px">You've been invited to join <strong>${safeName}</strong> on FlowPilot.</p>
         <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Accept invitation</a></p>
         <p style="margin:0;color:#64748b;font-size:13px">Or paste this link:<br/><span style="word-break:break-all">${link}</span></p>
         <p style="margin:16px 0 0;color:#64748b;font-size:13px">This invite expires in 7 days.</p>`,
      ),
    );
  }

  private frontendUrl(): string {
    return this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
  }

  private async send(
    to: string,
    subject: string,
    text: string,
    html: string,
  ): Promise<void> {
    const from = this.config.get<string>(
      'MAIL_FROM',
      'FlowPilot <noreply@flowpilot.local>',
    );

    if (!this.transporter) {
      this.logger.log(`[dev-mail] To: ${to} | ${subject}\n${text}`);
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
      });
      this.logger.log(`Mail sent to ${to} (${subject}) id=${info.messageId}`);
    } catch (error) {
      this.logger.error(
        `SMTP send failed to ${to}: ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'Email delivery is temporarily unavailable. Please try again shortly.',
      );
    }
  }

  private htmlLayout(title: string, body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;padding:28px 28px 24px;border:1px solid #e2e8f0">
        <tr><td>
          <p style="margin:0 0 4px;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:#0f766e;font-weight:700">FlowPilot</p>
          <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3">${title}</h1>
          ${body}
        </td></tr>
      </table>
      <p style="margin:16px 0 0;color:#94a3b8;font-size:12px">FlowPilot · project collaboration</p>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
