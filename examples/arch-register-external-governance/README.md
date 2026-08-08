# Arch Register external governance workflow example

This small service demonstrates an external governance workflow engine integrating with Arch
Register:

1. Arch Register starts an external governance workflow and sends a signed webhook.
2. The service creates an inbox item through the integrations API.
3. The service can submit an `approve`, `reject`, or `request_changes` decision through the same API.

It is intentionally a concrete, forkable example rather than a general workflow framework.

## Configure Arch Register

Use the `assessment.response` workflow for the walkthrough:

1. Open Workspace settings → Workflows.
2. Enable **Assessment responses** and check **External**.
3. Create a workspace webhook pointing to this service's `/webhook` endpoint.
4. Select `governance.workflow.started` as the operation.
5. Save the generated webhook secret immediately.

Create an API token scoped to the workspace with:

- `ws.view`
- `governance.external`

The example assigns the inbox item to the `ws.settings` capability by default. Set
`GOVERNANCE_TARGET_CAPABILITY` to another suitable capability if required.

Start an assessment workflow using the normal Arch Register assessment response flow. When the
workflow starts, Arch Register sends an event containing the case ID. The service uses that ID to
create the external inbox item.

## Run locally

```bash
cp .env.example .env
set -a
source .env
set +a
pnpm dev
```

The health endpoint is available at `http://127.0.0.1:3070/health` by default. Configure the
webhook URL as `https://your-host.example/webhook` for a deployed service.

Required environment variables are documented in `.env.example`:

- `ARCH_REGISTER_URL` is the Arch Register server origin, without `/api`.
- `ARCH_REGISTER_WORKSPACE` is the workspace slug.
- `ARCH_REGISTER_TOKEN` is the `ar_pat_...` integration token.
- `ARCH_REGISTER_WEBHOOK_SECRET` is the `whsec_...` webhook secret.

## Decisions

The service creates an inbox item and stops by default:

```bash
AUTO_DECISION=none pnpm start
```

To demonstrate each decision path, restart it with one of these values:

```bash
AUTO_DECISION=approve pnpm start
AUTO_DECISION=reject pnpm start
AUTO_DECISION=request_changes pnpm start
```

`DECISION_REASON` is sent with the decision request. A reason is especially useful for rejection
and request-changes decisions.

## Webhook payload and idempotency

The service verifies the raw request body using `x-arch-register-signature-256` before parsing the
JSON payload. It accepts `governance.workflow.started` events whose governance case is marked
external and ignores cases that are not external.

Retries are safe because request keys are derived from the Arch Register event ID:

- `external-governance:inbox:<event-id>` for inbox-item creation.
- `external-governance:decision:<event-id>:<decision>` for decisions.

Arch Register can therefore retry a webhook without creating duplicate inbox items or decisions.
Transient integration API failures return HTTP 500 so Arch Register can retry delivery. Invalid
signatures return HTTP 401 and malformed events return HTTP 400.

## Tests

```bash
pnpm test
pnpm typecheck
```
