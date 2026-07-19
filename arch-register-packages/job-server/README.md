# @arch-register/job-server

Standalone scheduler and worker process for system-created recurring workspace jobs.

## Local development

The worker can use SQLite for a single local worker when explicitly enabled:

```bash
JOB_SERVER_ALLOW_SQLITE=true \
DB_DRIVER=sqlite \
SQLITE_PATH=../server/data/arch-register.sqlite \
pnpm dev
```

Production and multi-worker deployments must use PostgreSQL:

```bash
DB_DRIVER=postgres \
DATABASE_URL=postgresql://arch_register:password@localhost:5432/arch_register \
JOB_SERVER_ID=jobs-eu-1 \
JOB_SERVER_NAME="EU job server 1" \
JOB_SERVER_MAX_CONCURRENCY=4 \
JOB_SERVER_JOB_TIMEOUT_MS=600000 \
JOB_SERVER_SHUTDOWN_TIMEOUT_MS=30000 \
pnpm start
```

The worker does not expose an HTTP listener. Job handlers are registered by system components and receive the run ID as `jobId` together with the workspace, schedule, system identity, and payload.

Email notification delivery uses Resend when `NOTIFICATION_EMAIL_PROVIDER=resend` and
`RESEND_API_KEY`, `NOTIFICATION_EMAIL_FROM`, and `PUBLIC_APP_URL` are configured. For a raw SMTP
server, set `NOTIFICATION_EMAIL_PROVIDER=smtp`, `SMTP_HOST`, and optionally `SMTP_PORT` (default
`587`), `SMTP_SECURE` (default `false`; use `true` for implicit TLS, typically port `465`),
`SMTP_USER`, and `SMTP_PASSWORD`. SMTP credentials must be supplied together when authentication
is required. Set `NOTIFICATION_EMAIL_RECIPIENT_DOMAIN_OVERRIDE` to a test domain to rewrite all
recipients while preserving their local parts; the sender is not changed.

AI metadata generation decrypts each workspace's stored AI provider credentials itself, so the job
server process needs the *same* `AI_ENCRYPTION_KEY` (and `AI_ENCRYPTION_SALT`, if the deployment set
a non-default one) as the main server — these are not read from the main server's `.env`
automatically since each process loads its own. Without a matching key, generation runs fail with
`AI_ENCRYPTION_KEY is required to read workspace AI credentials` (or a decryption error if the keys
don't match) and retry once before recording a permanent failure.

`JOB_SERVER_ID` is the stable server identity and must be unique among active job servers. It
defaults to the host name, so deployments that run multiple job servers on one host must configure
it explicitly.
`JOB_SERVER_NAME` controls the display name in job monitoring and defaults to the host name. The
server records a status ping every minute by default; `JOB_SERVER_PING_INTERVAL_MS` can override
that interval. Jobs are limited to ten minutes by default; `JOB_SERVER_JOB_TIMEOUT_MS` can override
the execution timeout. Shutdown waits up to 30 seconds for active jobs by default;
`JOB_SERVER_SHUTDOWN_TIMEOUT_MS` can override that deadline.
