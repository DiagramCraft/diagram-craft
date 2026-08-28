import type { StreamChunk } from '@tanstack/ai';

export type CapturedAiToolCall = {
  name: string;
  args: string;
  result?: unknown;
};

type TrackedAiToolCall = CapturedAiToolCall & {
  id: string;
};

const serializeToolInput = (input: unknown): string | undefined => {
  if (typeof input === 'string') return input;
  try {
    const serialized = JSON.stringify(input);
    return serialized === undefined ? undefined : serialized;
  } catch {
    return undefined;
  }
};

/**
 * Collects tool-call data from the AG-UI stream while keeping the existing
 * persisted metadata shape. Tool-call arguments and results are correlated by
 * the stable toolCallId rather than by stream position.
 */
export const createAiToolCallAccumulator = () => {
  const calls = new Map<string, TrackedAiToolCall>();
  const order: string[] = [];

  const consume = (chunk: StreamChunk) => {
    if (chunk.type === 'TOOL_CALL_START') {
      const name = chunk.toolCallName || chunk.toolName;
      if (!name || !chunk.toolCallId) return;

      const existing = calls.get(chunk.toolCallId);
      if (existing) {
        existing.name = name;
        return;
      }

      calls.set(chunk.toolCallId, {
        id: chunk.toolCallId,
        name,
        args: '',
        result: undefined
      });
      order.push(chunk.toolCallId);
      return;
    }

    if (chunk.type === 'TOOL_CALL_ARGS') {
      const call = calls.get(chunk.toolCallId);
      if (call) call.args += chunk.delta;
      return;
    }

    if (chunk.type === 'TOOL_CALL_END') {
      const call = calls.get(chunk.toolCallId);
      if (call && call.args.length === 0 && chunk.input !== undefined) {
        call.args = serializeToolInput(chunk.input) ?? '';
      }
      return;
    }

    if (chunk.type === 'TOOL_CALL_RESULT') {
      const call = calls.get(chunk.toolCallId);
      if (call) call.result = chunk.content;
    }
  };

  const getCall = (id: string) => calls.get(id);

  const getCalls = (): CapturedAiToolCall[] =>
    order.map(id => {
      const call = calls.get(id)!;
      return {
        name: call.name,
        args: call.args,
        ...(call.result !== undefined ? { result: call.result } : {})
      };
    });

  return { consume, getCall, getCalls };
};
