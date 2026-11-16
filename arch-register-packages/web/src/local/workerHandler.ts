import {
  type FromWorkerMessage,
  isNullBodyStatus,
  type MessagePortLike,
  type ToWorkerMessage,
  type WorkerRequestMessage
} from './workerProtocol';

type Handler = (request: Request) => Response | Promise<Response>;

/**
 * Serves requests arriving on `port` using `handler` (typically `app.fetch` of the h3 app),
 * streaming response bodies back chunk by chunk.
 */
export const serveRequests = (port: MessagePortLike, handler: Handler) => {
  const inFlight = new Map<number, AbortController>();
  const post = (msg: FromWorkerMessage, transfer: Transferable[] = []) =>
    port.postMessage(msg, transfer);

  const handle = async (msg: WorkerRequestMessage) => {
    const abort = new AbortController();
    inFlight.set(msg.id, abort);

    try {
      const hasBody = msg.body !== null && msg.method !== 'GET' && msg.method !== 'HEAD';
      const request = new Request(msg.url, {
        method: msg.method,
        headers: msg.headers,
        body: hasBody ? msg.body : undefined,
        signal: abort.signal
      });

      let response: Response;
      try {
        response = await handler(request);
      } catch {
        response = new Response('Internal Server Error', { status: 500 });
      }

      post({
        type: 'head',
        id: msg.id,
        status: response.status,
        statusText: response.statusText,
        headers: [...response.headers.entries()]
      });

      if (response.body && !isNullBodyStatus(response.status)) {
        const reader = response.body.getReader();
        abort.signal.addEventListener('abort', () => void reader.cancel().catch(() => {}), {
          once: true
        });
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          post({ type: 'chunk', id: msg.id, data: value }, [value.buffer]);
        }
      }
      post({ type: 'end', id: msg.id });
    } catch (e) {
      if (!abort.signal.aborted) {
        post({ type: 'error', id: msg.id, message: e instanceof Error ? e.message : String(e) });
      }
    } finally {
      inFlight.delete(msg.id);
    }
  };

  const onMessage = (e: MessageEvent) => {
    const msg = e.data as ToWorkerMessage;
    if (msg.type === 'request') void handle(msg);
    else if (msg.type === 'abort') inFlight.get(msg.id)?.abort();
  };

  port.addEventListener('message', onMessage);
  return () => port.removeEventListener('message', onMessage);
};
