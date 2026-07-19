# AI Setup In Arch Register

This document describes the current AI implementation in `arch-register-packages`:

- which routes are active
- how chat is configured
- which tools are exposed to the model
- how approval-gated mutations work
- how extraction works
- what is implemented vs. what is still incomplete

The focus here is the current code, not an idealized future design.

## High-Level Architecture

The active AI path is workspace-scoped and lives in the server package:

- Server entry point: `arch-register-packages/server/src/app.ts`
- AI routes: `arch-register-packages/server/src/routes/ai-chat.ts`
- Adapter/config resolution: `arch-register-packages/server/src/ai/tanstackAiAdapter.ts`
- System prompt builder: `arch-register-packages/server/src/ai/systemPromptBuilder.ts`
- Chat tools: `arch-register-packages/server/src/ai/chatTools.ts`
- Web chat hook: `arch-register-packages/web/src/hooks/useAiChat.ts`
- Assistant UI: `arch-register-packages/web/src/screens/AssistantScreen.tsx`
- Extract UI: `arch-register-packages/web/src/screens/ExtractScreen.tsx`
- AI settings UI: `arch-register-packages/web/src/screens/AiSettingsSection.tsx`

The mounted route set is:

- `POST /api/:workspace/ai/chat`
- `GET/POST/PATCH/DELETE /api/:workspace/ai/conversations`
- `GET /api/:workspace/ai/conversations/:conversationId/messages`
- `GET/PUT /api/:workspace/ai/config`
- `POST /api/:workspace/ai/extract`

There is also an older generic AI proxy route in `server/src/routes/ai.ts`, but it is not mounted by `server/src/app.ts`. The live implementation is the workspace-scoped route set in `ai-chat.ts`.

## Provider And Model Resolution

Provider/model setup is resolved in `server/src/ai/tanstackAiAdapter.ts`.

Current behavior:

- Supported adapter code paths: `openrouter` and `openai`
- Default provider: `openrouter`
- Default OpenRouter model: `anthropic/claude-sonnet-4-20250514`
- Default OpenAI model: `gpt-4o`
- Default temperature: `0.7`

API keys are resolved in this order:

1. Encrypted workspace key stored in the database
2. Environment variable fallback

Environment variable fallback:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

Workspace API-key storage:

- `AI_ENCRYPTION_KEY` is required before workspace AI configuration can store an API key.
- `AI_ENCRYPTION_SALT` is optional but should be set explicitly in production.
- Stored workspace credentials use the versioned `v1:` format and are never written as new plaintext.
- Existing unmarked values can be migrated with:

  ```bash
  AI_ENCRYPTION_KEY=... pnpm --filter @arch-register/server rotate:ai-keys -- --legacy-format=plaintext --check
  AI_ENCRYPTION_KEY=... pnpm --filter @arch-register/server rotate:ai-keys -- --legacy-format=plaintext --apply
  ```

For key rotation, set `AI_ENCRYPTION_KEY` and `AI_ENCRYPTION_KEY_OLD` (and the corresponding current/old salts when changing salts). Run the command in `--check` mode first, then `--apply`, while the application is stopped or in a maintenance window. Remove the old-key variables after a successful migration. Use `--legacy-format=ciphertext` when unmarked values use the previous AES-GCM format; migration aborts without writes if any value cannot be decrypted.

Important current caveat:

- The adapter code supports both `openrouter` and `openai`.
- The settings UI also exposes both.
- But `PUT /api/:workspace/ai/config` in `server/src/routes/ai-chat.ts` currently validates `provider === "openrouter"` only.

So in practice, the codebase is partway through supporting OpenAI in workspace config, but the config route is still effectively OpenRouter-only.

## Chat Flow

### Request Flow

The web client uses TanStack AI React:

- Hook: `web/src/hooks/useAiChat.ts`
- Transport: `fetchServerSentEvents(...)`
- Target: `/api/${workspaceSlug}/ai/chat`

The chat request is sent as an SSE-backed TanStack chat request. On the server:

1. Workspace is resolved from the route
2. Auth context is built
3. `ws.view` capability is required
4. AI config is resolved
5. A system prompt is generated from workspace data
6. A TanStack text adapter is created
7. Chat tools are attached
8. The response is streamed back as SSE

### System Prompt

`server/src/ai/systemPromptBuilder.ts` builds a workspace-aware prompt from:

- all schemas
- entity counts by schema
- lifecycle states
- teams
- optional custom workspace system prompt

The prompt tells the model to:

- answer questions about schemas, entities, and relationships
- use entity links in the form `[Name](entity:ENTITY_ID)`
- use tools for record-level inspection
- use mutation tools for changes
- rely on explicit approval for creates/updates

### Conversation Persistence

Conversation metadata is persisted:

- conversation rows are stored
- user messages are stored explicitly in `ai-chat.ts`

Current caveat:

- assistant responses are not explicitly persisted in `ai-chat.ts`
- there is a messages table and `listMessages(...)`, but the current route logic only writes user messages directly
- `useConversationMessages(...)` exists in the web client but is not currently the primary chat rendering path in `AssistantScreen.tsx`

So the AI conversation persistence story exists, but it is not yet a full "reload a conversation and reconstruct the entire assistant thread exactly as seen" implementation.

## Chat Tools

The current tools are defined in `server/src/ai/chatTools.ts`.

### Read Tools

#### `query_entities`

Purpose:

- search real entity records, not just schema definitions

Supported inputs:

- `query`
- `schemaId`
- `owner`
- `lifecycle`
- `limit`
- `offset`

Returns:

- total match count
- matched entities
- schema metadata
- matched metadata fields
- matched data fields
- small data preview

Permission handling:

- results are filtered through `PermissionChecker.hasEntityPermission(..., 'view_entity')`

#### `get_entity_details`

Purpose:

- inspect one entity in depth

Lookup options:

- `entityId`
- `slug`

Returns:

- entity metadata
- raw `data`
- schema fields
- outgoing relations
- incoming relations

Relations are derived by inspecting `reference` and `containment` fields.

### Mutation Tools

#### `create_entity`

Purpose:

- create a top-level entity from chat

Important behavior:

- `needsApproval: true`
- does not execute until the user explicitly approves

Input shape:

- `schemaId`
- `name`
- `slug`
- `namespace`
- `description`
- `owner`
- `lifecycle`
- `tags`
- `visibilityMode`
- `fields`

Behavior notes:

- if `slug` is omitted, it is derived from the entity name
- if `namespace` is omitted, it defaults to `default`
- owner is normalized against known teams
- lifecycle is normalized against known lifecycle states

Permission handling:

- creation checks `requireCanCreateTopLevelEntity(...)`

#### `update_entity`

Purpose:

- update an existing entity from chat

Important behavior:

- `needsApproval: true`
- does not execute until the user explicitly approves

Input shape:

- `entityId`
- optional metadata fields
- optional `fields` patch object

Behavior notes:

- the tool merges `fields` into existing entity `data`
- ownership / visibility changes require stronger permissions

Permission handling:

- normal edits require `edit_entity`
- owner / visibility changes require `admin_entity`

## Tool Approval Flow

Approval is implemented using TanStack AI's built-in approval model rather than ad hoc natural-language confirmation.

### Server Side

Mutation tools are marked:

- `needsApproval: true`

When the model calls one of those tools:

1. the tool call is generated
2. TanStack pauses execution
3. an `approval-requested` event is emitted
4. the tool call is represented in the UI message stream as a `tool-call` part with approval metadata
5. execution only continues after the client sends an approval response

### Client Side

The assistant screen renders approval-required tool calls as a structured approval card:

- file: `web/src/screens/AssistantScreen.tsx`
- styles: `web/src/screens/AssistantScreen.module.css`

The card shows:

- tool type: create or update
- schema or entity id
- selected metadata
- field-level proposed changes
- approval status
- approve / decline buttons when pending

The client responds by calling:

- `chat.addToolApprovalResponse({ id, approved })`

That re-enters the TanStack chat flow and either:

- executes the mutation tool if approved
- returns an error-like declined result if rejected

### Rendering Behavior

The assistant UI intentionally hides ordinary tool-only messages to avoid blank intermediate bubbles.

Exception:

- approval-required mutation tool calls are rendered as cards

This is why read tools stay invisible, but create/update proposals are visible and interactive.

## Clickable Entity Links

Assistant responses can link to entities using:

```md
[Payments API](entity:entity-id-here)
```

The assistant screen converts those links into in-app navigation to:

- `/$workspaceSlug/entities/$entityId`

This is used by:

- normal assistant text
- mutation success messages returned by tools

## Extraction Flow

Extraction is currently separate from chat.

### Route

- `POST /api/:workspace/ai/extract`

### Server Behavior

Implemented in `server/src/routes/ai-chat.ts`.

Flow:

1. Require `ws.view`
2. Resolve AI config
3. Read input text
4. Load available schemas
5. Build an extraction-specific prompt
6. Run a non-streaming chat call with low temperature (`0.3`)
7. Ask the model to return only JSON
8. Parse the first JSON array found in the returned text

Requested output shape:

```json
[
  {
    "name": "Entity Name",
    "schema_id": "schema-id",
    "fields": {},
    "confidence": 0.85,
    "source": "supporting text"
  }
]
```

### Web Behavior

Implemented in `web/src/screens/ExtractScreen.tsx`.

Flow:

1. User pastes text or uploads a file
2. UI calls `/api/:workspace/ai/extract`
3. Extracted rows are shown in review mode
4. User can accept/reject and edit names
5. "Commit" currently transitions to done state

Important current caveat:

- extraction does not currently create entities
- the screen contains a `TODO: Actually create entities via API`

So extraction is currently:

- prompt -> parse -> review UI

but not yet:

- prompt -> review -> create in database

## AI Settings UI

Workspace-level settings live in:

- `web/src/screens/AiSettingsSection.tsx`

Configurable fields:

- enabled
- provider
- API key
- model
- temperature
- custom system prompt

Route backing:

- `GET /api/:workspace/ai/config`
- `PUT /api/:workspace/ai/config`

The custom system prompt is appended after the generated workspace/system context. It is not a replacement for the built-in prompt.

## Permissions Summary

Current AI feature permissions:

- chat requires `ws.view`
- extract requires `ws.view`
- AI settings require `ws.settings`
- entity read tools are filtered by entity visibility
- create/update mutation tools enforce the same entity permission rules as normal server-side entity routes

This is important: the model is not trusted with extra rights. Tools run through normal server permission checks.

## Current Limitations And Gaps

### Chat / Tools

- Assistant message persistence is incomplete compared to user message persistence.
- Approval cards are generic summaries, not schema-aware diffs.
- `create_entity` currently focuses on top-level creation, not an explicit parent/containment workflow.

### Provider Configuration

- Adapter layer supports `openai` and `openrouter`.
- Settings UI exposes both.
- Config route still validates `openrouter` only.

### Extraction

- Extraction does not yet write accepted entities to the database.
- Uploaded PDFs are accepted by the UI, but the current client code only reads text directly for `.txt`, `.md`, and `.markdown`. There is no real PDF text extraction pipeline yet.

### Conversation History

- Conversation list CRUD exists.
- Exact assistant-thread replay/persistence is not yet fully wired.

## Suggested Next Steps

If this system is extended further, the highest-value follow-ups are:

1. Finish extraction commit flow by creating entities through the existing entity API or the same approval-gated mutation tools.
2. Persist assistant responses and tool outcomes so conversations can be reloaded accurately.
3. Fix the provider config mismatch so `openai` can be selected and saved cleanly.
4. Make approval cards schema-aware, especially for reference and containment fields.
5. Add mutation tools for delete, clone, or relationship-specific edits only if they follow the same approval-gated pattern.

## File Map

- Server route mount: `server/src/app.ts`
- Main AI route set: `server/src/routes/ai-chat.ts`
- Legacy generic AI route: `server/src/routes/ai.ts`
- Prompt builder: `server/src/ai/systemPromptBuilder.ts`
- Adapter/config: `server/src/ai/tanstackAiAdapter.ts`
- Chat tools: `server/src/ai/chatTools.ts`
- Assistant UI: `web/src/screens/AssistantScreen.tsx`
- Assistant transport hook: `web/src/hooks/useAiChat.ts`
- Extract UI: `web/src/screens/ExtractScreen.tsx`
- Settings UI: `web/src/screens/AiSettingsSection.tsx`
