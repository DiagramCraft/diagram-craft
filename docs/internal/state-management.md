# State management

State is owned by the narrowest durable source that can represent it. Do not copy state
between sources unless one copy is explicitly a transient draft.

## Ownership

| State kind | Owner | Examples |
| --- | --- | --- |
| Server state | TanStack Query | Workspaces, entities, projects, saved views |
| Navigation state | TanStack Router path and search | Current resource, section, tab, committed filter, navigational panel |
| Transient UI state | Local React state | Form drafts, hover, selection, menus, confirmations, pending mutations |
| Cross-tree dependencies | React context | Authentication, permissions, workspace services and stable callbacks |
| User preferences | Persistent user state | Theme, panel sizes, preferred picker layout |
| Recoverable sessions | Explicit session storage | Autosave and multi-window recovery |

Refs are for imperative handles and values that must not trigger rendering. They are not an
alternative state store. Context must not hide navigation state: if reloading or sharing a URL
should reproduce a value, that value belongs to the route.

## URL and history contract

- A reload must restore the workspace, screen or resource, selected section or tab, and any
  committed view state required to understand that screen.
- Meaningful user navigation creates a history entry. This includes selecting resources, tabs,
  saved views, committed filters, and navigational panels.
- High-frequency or mechanical changes replace the current entry. This includes typing,
  pagination, URL normalization, and technical session identifiers.
- Default values are omitted from search parameters. Route validators reject unknown values and
  screens provide a stable default.
- Components read navigation state from `useSearch` or `useParams`. They must not mirror it into
  local state with two-way effects. A text input may keep a local draft, but committing the draft
  updates the route.
- Navigational dialogs may use route state when they are useful deep-link targets. Form dialogs,
  confirmations, and destructive-action prompts remain local and do not add history entries.
- Unsaved form or editor data is allowed to be lost on reload. The URL must still return the user
  to the correct screen and mode.

## Review checklist

Before adding state, answer these questions in order:

1. Is it remote data? Use TanStack Query.
2. Must reload, sharing, Back, or Forward reproduce it? Put it in the route.
3. Is it a user preference or an explicit recovery feature? Persist it through the relevant
   preference or recovery service.
4. Is it needed by a coherent subtree? Keep it local and lift it only as far as necessary.
5. Is a context exposing mutable screen state or navigation callbacks? Prefer route state or a
   narrower component boundary.

## Follow-up inventory

DiagramCraft collaboration awareness is runtime state owned by the individual `Application`. It
is passed explicitly into document loading and collaboration comments, updates the collaboration
backend when changed, and is not persisted with `UserState`. The remaining preference, recent-file,
recovery, and reactive-subscription split is tracked in follow-up issue #2135.
