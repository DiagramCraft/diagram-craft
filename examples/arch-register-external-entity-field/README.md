# Arch Register external entity field example

This small service demonstrates an integration that lives entirely outside Arch Register:

1. Arch Register sends an HMAC-signed entity webhook.
2. The service reads the changed entity through the public API.
3. It calls GitHub's `GET /repos/{owner}/{repo}/releases/latest` endpoint.
4. It writes the release tag back to one integration-owned Arch Register field.

It is intentionally a concrete example rather than a general integration framework. Fork it and
replace `src/github.ts` with the API your deployment needs.

## Configure Arch Register

Add two fields to the entity schema you want to hydrate:

- `github_repository` — a normal text field containing `owner/repo`, such as `DiagramCraft/diagram-craft`.
- `github_latest_release` — a text field with `external_kind: "integration"` and `refresh_mode: "on_change"`.

The field IDs are configurable, so these names are only the defaults used by `.env.example`.

Create an API token scoped to the workspace with:

- `ws.view`
- `ent.external_update`

The external update path permits the token to change only the field named by `_external.fieldId`.
Ordinary entity edits still require ordinary edit permissions.

Create a workspace webhook pointing to this service's `/webhook` endpoint. Use `create` and `update`
operations; leave `schema_ids` empty to receive events for all schemas, or select the schema containing
the fields above. Save the generated webhook secret immediately.

## Run locally

```bash
cp .env.example .env
pnpm --ignore-workspace install
pnpm --ignore-workspace dev
```

The health endpoint is available at `http://127.0.0.1:3060/health` by default. For a deployed service,
configure the webhook URL as `https://your-host.example/webhook`.

Required environment variables are documented in `.env.example`:

- `ARCH_REGISTER_URL` is the Arch Register server origin, without `/api`.
- `ARCH_REGISTER_WORKSPACE` is the workspace slug.
- `ARCH_REGISTER_TOKEN` is the Arch Register `ar_pat_...` token.
- `ARCH_REGISTER_WEBHOOK_SECRET` is the webhook `whsec_...` secret.
- `SOURCE_FIELD_ID` identifies the repository field.
- `TARGET_FIELD_ID` identifies the integration-owned release field.
- `GITHUB_TOKEN` is optional and useful for private repositories or higher rate limits.

## Failure and retry behavior

Invalid signatures and malformed requests are rejected. A missing repository, an invalid repository
value, or a GitHub 404 is recorded as a failed external update while retaining the prior field value.
Transient GitHub errors and Arch Register API failures return a 5xx response so Arch Register's webhook
delivery job can retry them.

The service ignores its own external-update webhook and skips writes when the release tag is unchanged,
which prevents a successful write-back from creating an endless webhook loop.

## Tests

```bash
pnpm --ignore-workspace test
pnpm --ignore-workspace typecheck
```
