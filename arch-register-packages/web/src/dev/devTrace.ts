/**
 * Dev-only client-side tracing. Correlates a user interaction (click / navigation)
 * with the API requests it triggers, and pulls the server-side request + SQL
 * spans back for display in the DEV panel.
 *
 * Inert unless {@link setDevTracingEnabled} has been called with `true` (driven
 * by the `dev.config` endpoint's `tracingEnabled` flag).
 */

export const TRACE_ID_HEADER = 'x-dev-trace-id';
export const SPAN_ID_HEADER = 'x-dev-span-id';
export const INTERACTION_HEADER = 'x-dev-interaction';

const MAX_INTERACTIONS = 30;
const IDLE_MS = 3000;

export type ServerSqlSpan = {
  id: string;
  durationMs: number;
  sql: string;
  params: string[];
  rowCount: number | null;
  error?: string;
};

export type ServerRequestSpan = {
  spanId: string;
  method: string;
  path: string;
  durationMs: number | null;
  status: number | null;
  error?: string;
  sql: ServerSqlSpan[];
};

export type ServerTrace = {
  traceId: string;
  interaction?: string;
  requests: ServerRequestSpan[];
};

export type TracedRequest = {
  spanId: string;
  method: string;
  url: string;
  startedAt: number;
  endedAt: number | null;
  status: number | null;
  error: string | undefined;
  server: ServerRequestSpan | null;
};

export type Interaction = {
  traceId: string;
  kind: 'click' | 'change' | 'navigate';
  label: string;
  startedAt: number;
  requests: TracedRequest[];
};

let enabled = false;
let interactions: Interaction[] = [];
let activeTraceId: string | null = null;
let activeExpiresAt = 0;
const listeners = new Set<() => void>();

const genId = () =>
  Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);

const emit = () => {
  interactions = interactions.slice();
  for (const listener of listeners) listener();
};

export const setDevTracingEnabled = (value: boolean) => {
  enabled = value;
};

export const isDevTracingEnabled = () => enabled;

export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getInteractions = () => interactions;

export const clearInteractions = () => {
  interactions = [];
  activeTraceId = null;
  emit();
};

export const beginInteraction = (kind: Interaction['kind'], label: string) => {
  if (!enabled) return;
  const traceId = genId();
  const interaction: Interaction = {
    traceId,
    kind,
    label: label.slice(0, 80) || '(unlabeled)',
    startedAt: Date.now(),
    requests: []
  };
  interactions = [interaction, ...interactions].slice(0, MAX_INTERACTIONS);
  activeTraceId = traceId;
  activeExpiresAt = Date.now() + IDLE_MS;
  emit();
};

const currentInteraction = (): Interaction | undefined => {
  if (!enabled || !activeTraceId || Date.now() > activeExpiresAt) return undefined;
  return interactions.find(i => i.traceId === activeTraceId);
};

export type RequestHandle = { traceId: string; spanId: string; interaction: Interaction } | null;

export const startRequest = (method: string, url: string): RequestHandle => {
  const interaction = currentInteraction();
  if (!interaction) return null;

  const spanId = genId();
  interaction.requests.push({
    spanId,
    method,
    url,
    startedAt: Date.now(),
    endedAt: null,
    status: null,
    error: undefined,
    server: null
  });
  activeExpiresAt = Date.now() + IDLE_MS;
  emit();
  return { traceId: interaction.traceId, spanId, interaction };
};

export const finishRequest = (
  handle: RequestHandle,
  result: { status?: number; error?: string }
) => {
  if (!handle) return;
  const request = handle.interaction.requests.find(r => r.spanId === handle.spanId);
  if (!request) return;
  request.endedAt = Date.now();
  request.status = result.status ?? null;
  request.error = result.error;
  emit();
};

/**
 * Merge a server-side trace (fetched by the DEV panel via `dev.trace`) into the
 * matching client-recorded interaction. Kept here so the panel — not this
 * module — owns the API client dependency.
 */
export const attachServerTrace = (trace: ServerTrace) => {
  const interaction = interactions.find(i => i.traceId === trace.traceId);
  if (!interaction) return;
  let changed = false;
  for (const request of interaction.requests) {
    const match = trace.requests.find(r => r.spanId === request.spanId);
    if (match && match !== request.server) {
      request.server = match;
      changed = true;
    }
  }
  if (changed) emit();
};

/** Trace ids of interactions that have finished requests still missing server spans. */
export const pendingServerTraceIds = (): string[] =>
  interactions
    .filter(i => i.requests.some(r => r.endedAt != null && r.server == null))
    .map(i => i.traceId);

const describeControl = (el: Element): string => {
  const explicit = el.closest('[data-trace-label]')?.getAttribute('data-trace-label');
  if (explicit) return explicit;

  const labelledById = el.getAttribute('aria-labelledby');
  const labelledBy = labelledById
    ? el.ownerDocument.getElementById(labelledById)?.textContent
    : null;

  const associatedLabel =
    el instanceof HTMLInputElement || el instanceof HTMLSelectElement
      ? (el.labels?.[0]?.textContent ?? null)
      : null;

  const candidate =
    el.getAttribute('aria-label') ??
    labelledBy ??
    associatedLabel ??
    (el instanceof HTMLInputElement ? (el.placeholder ?? el.name) : null) ??
    el.getAttribute('name') ??
    el.getAttribute('title') ??
    el.closest('label')?.textContent ??
    (el.textContent ?? '').trim() ??
    el.tagName.toLowerCase();

  return (candidate ?? el.tagName.toLowerCase()).replace(/\s+/g, ' ').trim().slice(0, 60);
};

const labelFromElement = (target: EventTarget | null): string | null => {
  if (!(target instanceof Element)) return null;
  // Ignore events originating inside the DEV panel itself.
  if (target.closest('[data-dev-trace-ignore]')) return null;
  const actionable = target.closest(
    'button, a, [role="button"], [role="tab"], [role="menuitem"], [role="link"],' +
      ' [role="option"], [role="switch"], [role="checkbox"], [role="radio"], [data-trace-label]'
  );
  if (!actionable) return null;
  return describeControl(actionable);
};

const labelFromControlChange = (target: EventTarget | null): string | null => {
  if (!(target instanceof Element)) return null;
  if (target.closest('[data-dev-trace-ignore]')) return null;
  if (
    !(
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement ||
      target.getAttribute('role') === 'combobox'
    )
  ) {
    return null;
  }
  return describeControl(target);
};

let initialized = false;

export const initDevTrace = () => {
  if (initialized || typeof document === 'undefined') return;
  initialized = true;
  document.addEventListener(
    'click',
    event => {
      if (!enabled) return;
      const label = labelFromElement(event.target);
      if (label) beginInteraction('click', `click: ${label}`);
    },
    { capture: true }
  );
  document.addEventListener(
    'change',
    event => {
      if (!enabled) return;
      const label = labelFromControlChange(event.target);
      if (label) beginInteraction('change', `change: ${label}`);
    },
    { capture: true }
  );
};

export const recordNavigation = (pathname: string) => {
  // A filter/control change often writes to the URL, so a click/change interaction
  // and this navigation describe the same user action. If one was just created and
  // hasn't captured requests yet, relabel it instead of splitting into two.
  const active = interactions[0];
  if (
    active &&
    active.traceId === activeTraceId &&
    active.kind !== 'navigate' &&
    active.requests.length === 0 &&
    Date.now() - active.startedAt < 500
  ) {
    active.kind = 'navigate';
    active.label = `navigate: ${pathname}`.slice(0, 80);
    activeExpiresAt = Date.now() + IDLE_MS;
    emit();
    return;
  }
  beginInteraction('navigate', `navigate: ${pathname}`);
};
