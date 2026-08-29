import nodemailer from 'nodemailer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createEmailDeliveryConfigFromEnv,
  PermanentEmailError,
  RetryableEmailError,
  ResendEmailProvider,
  SmtpEmailProvider,
  overrideRecipientDomain
} from './emailDelivery';

const message = {
  to: 'alice@example.com',
  from: 'notifications@example.com',
  subject: 'A notification',
  html: '<p>A notification</p>',
  text: 'A notification',
  idempotencyKey: 'notification-delivery:1'
};

const transporterForTest = () =>
  ({ sendMail: vi.fn() }) as unknown as ConstructorParameters<typeof SmtpEmailProvider>[0];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('email delivery helpers', () => {
  it('rewrites only the recipient domain while preserving the local part', () => {
    expect(overrideRecipientDomain('alice+test@example.com', 'mail.test')).toBe(
      'alice+test@mail.test'
    );
  });

  it('leaves recipients unchanged when no override is configured', () => {
    expect(overrideRecipientDomain('alice@example.com', null)).toBe('alice@example.com');
  });

  it('rejects malformed recipient domains', () => {
    expect(() => overrideRecipientDomain('alice@example.com', '.invalid')).toThrow();
  });
});

describe('SmtpEmailProvider', () => {
  it('sends the email contents and returns the SMTP message ID', async () => {
    const transporter = transporterForTest();
    vi.mocked(transporter.sendMail).mockResolvedValue({
      messageId: '<message-1@example.com>',
      envelope: { from: message.from, to: [message.to] },
      accepted: [message.to],
      rejected: [],
      pending: [],
      response: '250 OK'
    });
    const provider = new SmtpEmailProvider(transporter);

    await expect(provider.send(message, new AbortController().signal)).resolves.toEqual({
      id: '<message-1@example.com>'
    });
    expect(transporter.sendMail).toHaveBeenCalledWith({
      from: message.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text
    });
  });

  it('retries transient SMTP responses and connection failures', async () => {
    const transientResponse = Object.assign(new Error('mailbox temporarily unavailable'), {
      responseCode: 421
    });
    const connectionFailure = Object.assign(new Error('connection timed out'), {
      code: 'ETIMEDOUT'
    });

    for (const error of [transientResponse, connectionFailure]) {
      const transporter = transporterForTest();
      vi.mocked(transporter.sendMail).mockRejectedValue(error);
      const provider = new SmtpEmailProvider(transporter);

      await expect(provider.send(message, new AbortController().signal)).rejects.toBeInstanceOf(
        RetryableEmailError
      );
    }
  });

  it('marks permanent SMTP responses as permanent failures', async () => {
    const transporter = transporterForTest();
    vi.mocked(transporter.sendMail).mockRejectedValue(
      Object.assign(new Error('authentication failed'), { responseCode: 535 })
    );
    const provider = new SmtpEmailProvider(transporter);

    await expect(provider.send(message, new AbortController().signal)).rejects.toBeInstanceOf(
      PermanentEmailError
    );
  });
});

describe('ResendEmailProvider', () => {
  it('sends the email contents with an idempotency key and returns the message ID', async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: 'resend-message-1' }, error: null });
    const client = { emails: { send } } as unknown as ConstructorParameters<
      typeof ResendEmailProvider
    >[0];
    const provider = new ResendEmailProvider(client);

    await expect(provider.send(message, new AbortController().signal)).resolves.toEqual({
      id: 'resend-message-1'
    });
    expect(send).toHaveBeenCalledWith(
      {
        from: message.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text
      },
      { idempotencyKey: message.idempotencyKey }
    );
  });

  it('classifies transient Resend responses as retryable', async () => {
    for (const statusCode of [408, 429, 503]) {
      const send = vi.fn().mockResolvedValue({
        data: null,
        error: Object.assign(new Error(`Resend status ${statusCode}`), { statusCode })
      });
      const client = { emails: { send } } as unknown as ConstructorParameters<
        typeof ResendEmailProvider
      >[0];

      await expect(
        new ResendEmailProvider(client).send(message, new AbortController().signal)
      ).rejects.toBeInstanceOf(RetryableEmailError);
    }
  });

  it('classifies permanent responses and missing IDs correctly', async () => {
    const permanentSend = vi.fn().mockResolvedValue({
      data: null,
      error: Object.assign(new Error('invalid recipient'), { statusCode: 400 })
    });
    const permanentClient = {
      emails: { send: permanentSend }
    } as unknown as ConstructorParameters<typeof ResendEmailProvider>[0];
    await expect(
      new ResendEmailProvider(permanentClient).send(message, new AbortController().signal)
    ).rejects.toBeInstanceOf(PermanentEmailError);

    const missingIdSend = vi.fn().mockResolvedValue({ data: {}, error: null });
    const missingIdClient = {
      emails: { send: missingIdSend }
    } as unknown as ConstructorParameters<typeof ResendEmailProvider>[0];
    await expect(
      new ResendEmailProvider(missingIdClient).send(message, new AbortController().signal)
    ).rejects.toBeInstanceOf(RetryableEmailError);
  });

  it('does not call Resend when delivery is already aborted', async () => {
    const send = vi.fn();
    const client = { emails: { send } } as unknown as ConstructorParameters<
      typeof ResendEmailProvider
    >[0];
    const controller = new AbortController();
    controller.abort(new Error('cancelled'));

    await expect(new ResendEmailProvider(client).send(message, controller.signal)).rejects.toThrow(
      'cancelled'
    );
    expect(send).not.toHaveBeenCalled();
  });
});

describe('SMTP environment configuration', () => {
  it('creates an SMTP provider with TLS and authentication settings', () => {
    vi.stubEnv('NOTIFICATION_EMAIL_PROVIDER', 'smtp');
    vi.stubEnv('SMTP_HOST', 'smtp.example.com');
    vi.stubEnv('SMTP_PORT', '465');
    vi.stubEnv('SMTP_SECURE', 'true');
    vi.stubEnv('SMTP_USER', 'smtp-user');
    vi.stubEnv('SMTP_PASSWORD', 'smtp-password');
    const createTransport = vi.spyOn(nodemailer, 'createTransport');

    const config = createEmailDeliveryConfigFromEnv();

    expect(config.provider?.name).toBe('smtp');
    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      auth: { user: 'smtp-user', pass: 'smtp-password' }
    });
  });

  it('defaults to an unauthenticated STARTTLS-compatible configuration', () => {
    vi.stubEnv('NOTIFICATION_EMAIL_PROVIDER', 'smtp');
    vi.stubEnv('SMTP_HOST', 'smtp.example.com');
    const createTransport = vi.spyOn(nodemailer, 'createTransport');

    const config = createEmailDeliveryConfigFromEnv();

    expect(config.provider?.name).toBe('smtp');
    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false
    });
  });

  it('rejects incomplete authentication and invalid connection settings', () => {
    vi.stubEnv('NOTIFICATION_EMAIL_PROVIDER', 'smtp');
    vi.stubEnv('SMTP_HOST', 'smtp.example.com');
    vi.stubEnv('SMTP_USER', 'smtp-user');
    expect(() => createEmailDeliveryConfigFromEnv()).toThrow(
      'SMTP_USER and SMTP_PASSWORD must be configured together'
    );

    vi.stubEnv('SMTP_PASSWORD', 'smtp-password');
    vi.stubEnv('SMTP_PORT', 'not-a-port');
    expect(() => createEmailDeliveryConfigFromEnv()).toThrow("Invalid SMTP_PORT 'not-a-port'");
  });
});
