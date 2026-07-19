import { Resend } from 'resend';
import type { DatabaseAdapter } from '../../db/database';
import { buildUserAuthCtx } from '../auth/authorization';
import { PermissionChecker } from '@arch-register/permissions';
import { isGovernanceCaseVisible } from '../governance/governanceOperations';
import { createGovernanceRegistry } from '../governance/governanceRegistry';
import { retryDelayMs } from '../jobs/jobRetry';
import { createJobSchedule } from '../jobs/jobOperations';
import type { InboxNotificationDbResult } from './db/notificationDatabase';
import { createLogger } from '../../utils/logger';

const logger = createLogger('notification-email');

export const NOTIFICATION_DELIVERY_JOB_TYPE = 'notification.delivery';
export const NOTIFICATION_DELIVERY_SYSTEM_IDENTITY = 'notifications';

export const ensureNotificationDeliverySchedule = async (
  db: DatabaseAdapter,
  workspace: string,
  now = new Date()
) => {
  const schedules = await db.jobs.listSchedules(workspace);
  const existing = schedules.find(
    schedule =>
      schedule.job_type === NOTIFICATION_DELIVERY_JOB_TYPE &&
      schedule.system_identity === NOTIFICATION_DELIVERY_SYSTEM_IDENTITY
  );
  if (existing) return existing;
  return createJobSchedule(
    db,
    {
      workspace,
      jobType: NOTIFICATION_DELIVERY_JOB_TYPE,
      systemIdentity: NOTIFICATION_DELIVERY_SYSTEM_IDENTITY,
      payload: {},
      priority: 5,
      recurrence: { type: 'minutes', intervalMinutes: 2, startsAt: now }
    },
    now
  );
};

export const ensureAllNotificationDeliverySchedules = async (
  db: DatabaseAdapter,
  now = new Date()
) => {
  const workspaces = await db.workspace.listWorkspaces();
  for (const workspace of workspaces) {
    await ensureNotificationDeliverySchedule(db, workspace.id, now);
  }
};

export type EmailMessage = {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

export type EmailProvider = {
  name: string;
  send(message: EmailMessage, signal: AbortSignal): Promise<{ id: string }>;
};

export class RetryableEmailError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = 'RetryableEmailError';
  }
}

export class PermanentEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentEmailError';
  }
}

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

export type EmailDeliveryConfig = {
  provider: EmailProvider | null;
  from: string | null;
  publicAppUrl: string | null;
  recipientDomainOverride: string | null;
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

  if (providerName !== 'resend') {
    throw new Error(`Unsupported notification email provider '${providerName}'`);
  }

  return {
    provider: apiKey ? new ResendEmailProvider(new Resend(apiKey)) : null,
    from,
    publicAppUrl,
    recipientDomainOverride
  };
};

export const overrideRecipientDomain = (email: string, domain: string | null) => {
  if (!domain) return email;
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) {
    throw new PermanentEmailError('Recipient email address is invalid');
  }
  if (!/^[a-z0-9.-]+$/i.test(domain) || domain.startsWith('.') || domain.endsWith('.')) {
    throw new PermanentEmailError('Recipient domain override is invalid');
  }
  return `${email.slice(0, at)}@${domain}`;
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const absoluteUrl = (baseUrl: string, path: string) => {
  try {
    return new URL(path, `${baseUrl.replace(/\/$/, '')}/`).toString();
  } catch {
    throw new PermanentEmailError('PUBLIC_APP_URL is invalid');
  }
};

const notificationRoute = async (
  db: DatabaseAdapter,
  notification: InboxNotificationDbResult,
  userId: string
) => {
  const workspace = await db.workspace.getWorkspace(notification.workspace);
  if (!workspace) return { authorized: false, reason: 'workspace-not-found' } as const;
  const authCtx = await buildUserAuthCtx(db, notification.workspace, userId);
  const checker = new PermissionChecker();

  if (notification.resource_type === 'entity') {
    const entity = await db.catalog.getEntity(notification.workspace, notification.resource_id);
    if (!entity || !checker.hasEntityPermission(authCtx, entity, 'view_entity')) {
      return { authorized: false, reason: 'authorization-revoked' } as const;
    }
    const publicId = entity.public_id ?? entity.id;
    return {
      authorized: true,
      urlPath: `/${encodeURIComponent(workspace.url_slug)}/entities/${encodeURIComponent(publicId)}`
    } as const;
  }

  if (notification.case_id) {
    const caseRow = await db.governance.getCase(notification.workspace, notification.case_id);
    if (!caseRow) return { authorized: false, reason: 'resource-not-found' } as const;
    const assignments = await db.governance.listAssignmentsForCase(caseRow.id);
    const visible = await isGovernanceCaseVisible(
      db,
      authCtx,
      userId,
      caseRow,
      assignments,
      createGovernanceRegistry()
    );
    if (!visible) return { authorized: false, reason: 'authorization-revoked' } as const;
    return {
      authorized: true,
      urlPath: `/${encodeURIComponent(workspace.url_slug)}/governance?caseId=${encodeURIComponent(caseRow.id)}`
    } as const;
  }

  return { authorized: false, reason: 'resource-not-found' } as const;
};

const buildEmail = (
  notification: InboxNotificationDbResult,
  url: string,
  workspaceName: string
) => {
  const title = escapeHtml(notification.title);
  const message = escapeHtml(notification.message);
  const escapedUrl = escapeHtml(url);
  const action = notification.category === 'action' ? 'Review in My Work' : 'View in Arch Register';
  const subject = `${workspaceName}: ${notification.title}`;
  return {
    subject,
    html: `<main><h1>${title}</h1><p>${message}</p><p><a href="${escapedUrl}">${action}</a></p></main>`,
    text: `${notification.title}\n\n${notification.message}\n\n${action}: ${url}`
  };
};

export const createNotificationDeliveryJobHandler = (
  db: DatabaseAdapter,
  config: EmailDeliveryConfig,
  options: { batchSize?: number; leaseDurationMs?: number; now?: () => Date } = {}
) => {
  const now = options.now ?? (() => new Date());
  const batchSize = options.batchSize ?? 100;
  const leaseDurationMs = options.leaseDurationMs ?? 120_000;

  return async (context: {
    workspace: string;
    payload: Record<string, unknown>;
    signal?: AbortSignal;
  }) => {
    if (!config.provider || !config.from || !config.publicAppUrl) {
      return { processed: 0, skipped: 0, reason: 'email-provider-not-configured' };
    }

    const signal = context.signal ?? new AbortController().signal;
    const claims = await db.notificationDelivery.claimPending(
      context.workspace,
      batchSize,
      now(),
      leaseDurationMs
    );
    let sent = 0;
    let skipped = 0;

    for (const claim of claims) {
      if (signal.aborted) throw signal.reason ?? new Error('Email delivery aborted');
      const notification = await db.notification.getNotification(claim.notification_id);
      const user = await db.auth.getUser(claim.user_id);
      if (!notification || !user?.is_active || !user.email) {
        await db.notificationDelivery.markSkipped(
          claim.id,
          claim.lease_token,
          !notification ? 'notification-not-found' : 'recipient-ineligible',
          now()
        );
        skipped++;
        continue;
      }

      try {
        const route = await notificationRoute(db, notification, claim.user_id);
        if (!route.authorized) {
          await db.notificationDelivery.markSkipped(
            claim.id,
            claim.lease_token,
            route.reason,
            now()
          );
          skipped++;
          continue;
        }
        const workspace = await db.workspace.getWorkspace(notification.workspace);
        if (!workspace) throw new PermanentEmailError('Workspace not found');
        const url = absoluteUrl(config.publicAppUrl, route.urlPath);
        const email = buildEmail(notification, url, workspace.name);
        const recipient = overrideRecipientDomain(
          claim.recipient_email,
          config.recipientDomainOverride
        );
        logger.info('Sending notification email', {
          deliveryId: claim.id,
          notificationId: claim.notification_id,
          workspace: claim.workspace,
          userId: claim.user_id,
          provider: config.provider.name,
          to: recipient,
          subject: email.subject,
          attempt: claim.attempt_count
        });
        const result = await config.provider.send(
          {
            to: recipient,
            from: config.from,
            subject: email.subject,
            html: email.html,
            text: email.text,
            idempotencyKey: `notification-delivery:${claim.id}`
          },
          signal
        );
        await db.notificationDelivery.markSent(
          claim.id,
          claim.lease_token,
          config.provider.name,
          result.id,
          now()
        );
        logger.info('Notification email sent', {
          deliveryId: claim.id,
          notificationId: claim.notification_id,
          workspace: claim.workspace,
          userId: claim.user_id,
          provider: config.provider.name,
          providerMessageId: result.id,
          to: recipient,
          subject: email.subject,
          attempt: claim.attempt_count
        });
        sent++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn('Notification email delivery failed', {
          deliveryId: claim.id,
          notificationId: claim.notification_id,
          workspace: claim.workspace,
          userId: claim.user_id,
          provider: config.provider.name,
          error: message,
          attempt: claim.attempt_count
        });
        if (error instanceof RetryableEmailError && claim.attempt_count < claim.max_attempts) {
          await db.notificationDelivery.markRetry(
            claim.id,
            claim.lease_token,
            new Date(now().getTime() + retryDelayMs(claim.attempt_count, error.retryAfterMs)),
            message,
            now()
          );
        } else if (error instanceof RetryableEmailError || error instanceof PermanentEmailError) {
          await db.notificationDelivery.markFailed(claim.id, claim.lease_token, message, now());
        } else {
          await db.notificationDelivery.markFailed(claim.id, claim.lease_token, message, now());
        }
      }
    }

    return { processed: claims.length, sent, skipped };
  };
};
