import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import {
  PermanentEmailError,
  RetryableEmailError,
  type EmailDeliveryConfig,
  type EmailMessage,
  type EmailProvider
} from './emailDelivery';

const responseStatus = (error: unknown) => {
  if (typeof error !== 'object' || error == null) return undefined;
  const value = (error as { statusCode?: unknown }).statusCode;
  return typeof value === 'number' ? value : undefined;
};

export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';

  constructor(private readonly client: Resend) {}

  async send(message: EmailMessage, signal: AbortSignal) {
    if (signal.aborted) throw signal.reason ?? new Error('Email delivery aborted');
    const result = await this.client.emails.send(
      {
        from: message.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text
      },
      { idempotencyKey: message.idempotencyKey }
    );
    if (result.error) {
      const status = responseStatus(result.error);
      const errorMessage = result.error.message ?? 'Resend rejected the email';
      if (status === 408 || status === 429 || (status != null && status >= 500)) {
        throw new RetryableEmailError(errorMessage);
      }
      throw new PermanentEmailError(errorMessage);
    }
    if (!result.data?.id) throw new RetryableEmailError('Resend returned no message ID');
    return { id: result.data.id };
  }
}

type SmtpError = {
  code?: unknown;
  responseCode?: unknown;
};

const smtpResponseCode = (error: unknown) => {
  if (typeof error !== 'object' || error == null) return undefined;
  const value = (error as SmtpError).responseCode;
  return typeof value === 'number' ? value : undefined;
};

const smtpErrorCode = (error: unknown) => {
  if (typeof error !== 'object' || error == null) return undefined;
  const value = (error as SmtpError).code;
  return typeof value === 'string' ? value : undefined;
};

const retryableSmtpErrorCodes = new Set([
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'ECONNABORTED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
  'ESOCKET',
  'ETIMEDOUT'
]);

const smtpErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const toEmailError = (error: unknown) => {
  const responseCode = smtpResponseCode(error);
  const errorMessage = smtpErrorMessage(error);
  if (
    (responseCode != null && responseCode >= 400 && responseCode < 500) ||
    retryableSmtpErrorCodes.has(smtpErrorCode(error) ?? '')
  ) {
    return new RetryableEmailError(errorMessage);
  }
  return new PermanentEmailError(errorMessage);
};

export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';

  constructor(private readonly transporter: ReturnType<typeof nodemailer.createTransport>) {}

  async send(message: EmailMessage, signal: AbortSignal) {
    if (signal.aborted) throw signal.reason ?? new Error('Email delivery aborted');
    try {
      const result = await this.transporter.sendMail({
        from: message.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text
      });
      if (!result.messageId) throw new RetryableEmailError('SMTP returned no message ID');
      return { id: result.messageId };
    } catch (error) {
      if (error instanceof RetryableEmailError || error instanceof PermanentEmailError) {
        throw error;
      }
      throw toEmailError(error);
    }
  }
}

const smtpPortFromEnv = () => {
  const value = process.env['SMTP_PORT']?.trim() || '587';
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid SMTP_PORT '${value}'`);
  }
  return port;
};

const smtpSecureFromEnv = () => {
  const value = process.env['SMTP_SECURE']?.trim().toLowerCase() || 'false';
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`Invalid SMTP_SECURE '${value}'`);
};

export const createEmailDeliveryConfigFromEnv = (): EmailDeliveryConfig => {
  const providerName = (process.env['NOTIFICATION_EMAIL_PROVIDER'] ?? 'resend')
    .trim()
    .toLowerCase();
  const apiKey = process.env['RESEND_API_KEY']?.trim() ?? '';
  const from = process.env['NOTIFICATION_EMAIL_FROM']?.trim() || null;
  const publicAppUrl = process.env['PUBLIC_APP_URL']?.trim().replace(/\/$/, '') || null;
  const recipientDomainOverride =
    process.env['NOTIFICATION_EMAIL_RECIPIENT_DOMAIN_OVERRIDE']?.trim().replace(/^@/, '') || null;

  if (providerName !== 'resend' && providerName !== 'smtp') {
    throw new Error(`Unsupported notification email provider '${providerName}'`);
  }

  let provider: EmailProvider | null = null;
  if (providerName === 'resend') {
    provider = apiKey ? new ResendEmailProvider(new Resend(apiKey)) : null;
  } else {
    const host = process.env['SMTP_HOST']?.trim() ?? '';
    const user = process.env['SMTP_USER']?.trim() ?? '';
    const password = process.env['SMTP_PASSWORD'] ?? '';
    if (Boolean(user) !== Boolean(password)) {
      throw new Error('SMTP_USER and SMTP_PASSWORD must be configured together');
    }
    if (host) {
      provider = new SmtpEmailProvider(
        nodemailer.createTransport({
          host,
          port: smtpPortFromEnv(),
          secure: smtpSecureFromEnv(),
          ...(user ? { auth: { user, pass: password } } : {})
        })
      );
    }
  }

  return {
    provider,
    from,
    publicAppUrl,
    recipientDomainOverride
  };
};
