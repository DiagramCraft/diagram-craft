import { useEffect, useSyncExternalStore, useState } from 'react';
import { orpcClient } from '../lib/orpcClient';
import {
  attachServerTrace,
  clearInteractions,
  getInteractions,
  pendingServerTraceIds,
  subscribe,
  type Interaction,
  type ServerTrace,
  type TracedRequest
} from './devTrace';
import styles from './DevTracePanel.module.css';

const useServerTracePolling = () => {
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      for (const traceId of pendingServerTraceIds()) {
        try {
          const trace = (await orpcClient.dev.trace({
            params: { traceId }
          })) as ServerTrace | null;
          if (!cancelled && trace) attachServerTrace(trace);
        } catch {
          // best-effort
        }
      }
    };
    void tick();
    const handle = window.setInterval(tick, 600);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, []);
};

const duration = (ms: number | null) => (ms == null ? '…' : `${Math.round(ms)}ms`);

const SqlRow = ({ span }: { span: NonNullable<TracedRequest['server']>['sql'][number] }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.sql}>
      <button type="button" className={styles.sqlHead} onClick={() => setOpen(v => !v)}>
        <span className={styles.time}>{duration(span.durationMs)}</span>
        <span className={styles.rows}>rows={span.rowCount ?? '-'}</span>
        <span className={styles.sqlText}>{span.sql.replace(/\s+/g, ' ')}</span>
      </button>
      {open && (
        <pre className={styles.sqlFull}>
          {span.sql}
          {span.params.length > 0 ? `\n\n-- params: ${JSON.stringify(span.params)}` : ''}
          {span.error ? `\n\n-- error: ${span.error}` : ''}
        </pre>
      )}
    </div>
  );
};

const RequestRow = ({ request }: { request: TracedRequest }) => {
  const [open, setOpen] = useState(true);
  const total = request.endedAt != null ? request.endedAt - request.startedAt : null;
  const path = (() => {
    try {
      return new URL(request.url).pathname;
    } catch {
      return request.url;
    }
  })();
  const sql = request.server?.sql ?? [];
  return (
    <div className={styles.request}>
      <button type="button" className={styles.requestHead} onClick={() => setOpen(v => !v)}>
        <span className={styles.method}>{request.method}</span>
        <span className={styles.path}>{path}</span>
        <span className={styles.status} data-error={request.error ? 'true' : undefined}>
          {request.error ? 'ERR' : (request.status ?? '…')}
        </span>
        <span className={styles.time}>{duration(total)}</span>
        <span className={styles.rows}>{sql.length} sql</span>
      </button>
      {open && sql.map(span => <SqlRow key={span.id} span={span} />)}
      {open && request.server == null && request.endedAt != null && (
        <div className={styles.pending}>no server spans (SQL trace unavailable)</div>
      )}
    </div>
  );
};

const InteractionRow = ({ interaction }: { interaction: Interaction }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className={styles.interaction}>
      <button type="button" className={styles.interactionHead} onClick={() => setOpen(v => !v)}>
        <span className={styles.kind}>{interaction.kind}</span>
        <span className={styles.label}>{interaction.label}</span>
        <span className={styles.rows}>{interaction.requests.length} req</span>
      </button>
      {open && interaction.requests.map(request => (
        <RequestRow key={request.spanId} request={request} />
      ))}
      {open && interaction.requests.length === 0 && (
        <div className={styles.pending}>no API requests</div>
      )}
    </div>
  );
};

export const DevTracePanel = () => {
  const interactions = useSyncExternalStore(subscribe, getInteractions);
  useServerTracePolling();

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <span>{interactions.length} interactions</span>
        <button type="button" onClick={clearInteractions}>
          clear
        </button>
      </div>
      {interactions.length === 0 && (
        <div className={styles.pending}>Click something or navigate to capture a trace.</div>
      )}
      {interactions.map(interaction => (
        <InteractionRow key={interaction.traceId} interaction={interaction} />
      ))}
    </div>
  );
};
