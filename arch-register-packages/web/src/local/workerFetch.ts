import {
  type FromWorkerMessage,
  isNullBodyStatus,
  type MessagePortLike,
  type ToWorkerMessage
} from './workerProtocol';

/**
 * Creates a fetch implementation that forwards requests to a server hosted in a Worker.
 * Response bodies are streamed, so event iterators / SSE behave as against a real server.
 */
export const createWorkerFetch = (port: MessagePortLike): typeof fetch => {
  let nextId = 1;

  return async (input, init) => {
    const request = new Request(input, init);
    const id = nextId++;
    const signal = request.signal;

    if (signal.aborted) {
      throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
    }

    const body =
      request.method === 'GET' || request.method === 'HEAD' ? null : await request.arrayBuffer();

    return new Promise<Response>((resolve, reject) => {
      let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
      let settled = false;
      let finished = false;

      const cleanup = () => {
        finished = true;
        port.removeEventListener('message', onMessage);
        signal.removeEventListener('abort', onAbort);
      };

      const abortError = () =>
        signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');

      const onAbort = () => {
        if (finished) return;
        port.postMessage({ type: 'abort', id } satisfies ToWorkerMessage);
        cleanup();
        if (settled) controller?.error(abortError());
        else reject(abortError());
      };

      const onMessage = (e: MessageEvent) => {
        const msg = e.data as FromWorkerMessage;
        if (!msg || msg.type === 'ready' || msg.id !== id) return;

        switch (msg.type) {
          case 'head': {
            settled = true;
            const stream = isNullBodyStatus(msg.status)
              ? null
              : new ReadableStream<Uint8Array>({
                  start: c => {
                    controller = c;
                  },
                  cancel: () => {
                    if (finished) return;
                    port.postMessage({ type: 'abort', id } satisfies ToWorkerMessage);
                    cleanup();
                  }
                });
            if (!stream) cleanup();
            resolve(
              new Response(stream, {
                status: msg.status,
                statusText: msg.statusText,
                headers: msg.headers
              })
            );
            break;
          }
          case 'chunk':
            controller?.enqueue(msg.data);
            break;
          case 'end':
            cleanup();
            controller?.close();
            break;
          case 'error': {
            cleanup();
            const err = new TypeError(msg.message);
            if (settled) controller?.error(err);
            else reject(err);
            break;
          }
        }
      };

      port.addEventListener('message', onMessage);
      signal.addEventListener('abort', onAbort, { once: true });

      const message: ToWorkerMessage = {
        type: 'request',
        id,
        method: request.method,
        url: request.url,
        headers: [...request.headers.entries()],
        body
      };
      port.postMessage(message, body ? [body] : []);
    });
  };
};
