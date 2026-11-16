export type WorkerRequestMessage = {
  type: 'request';
  id: number;
  method: string;
  url: string;
  headers: [string, string][];
  body: ArrayBuffer | null;
};

export type WorkerAbortMessage = { type: 'abort'; id: number };

export type ToWorkerMessage = WorkerRequestMessage | WorkerAbortMessage;

export type WorkerReadyMessage = { type: 'ready' };
export type WorkerHeadMessage = {
  type: 'head';
  id: number;
  status: number;
  statusText: string;
  headers: [string, string][];
};
export type WorkerChunkMessage = { type: 'chunk'; id: number; data: Uint8Array };
export type WorkerEndMessage = { type: 'end'; id: number };
export type WorkerErrorMessage = { type: 'error'; id: number; message: string };

export type FromWorkerMessage =
  | WorkerReadyMessage
  | WorkerHeadMessage
  | WorkerChunkMessage
  | WorkerEndMessage
  | WorkerErrorMessage;

/** Minimal message-port surface shared by Worker, MessagePort and test doubles */
export type MessagePortLike = {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: 'message', listener: (e: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (e: MessageEvent) => void): void;
};

const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);
export const isNullBodyStatus = (status: number) => NULL_BODY_STATUSES.has(status);
