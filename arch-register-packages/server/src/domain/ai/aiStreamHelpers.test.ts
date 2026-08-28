import { describe, expect, it } from 'vitest';
import type { StreamChunk } from '@tanstack/ai';
import { createAiToolCallAccumulator } from './aiStreamHelpers';

const streamChunk = (chunk: Record<string, unknown>) => chunk as unknown as StreamChunk;

describe('createAiToolCallAccumulator', () => {
  it('correlates interleaved argument and result events by tool call id', () => {
    const accumulator = createAiToolCallAccumulator();

    accumulator.consume(
      streamChunk({
        type: 'TOOL_CALL_START',
        toolCallId: 'call-a',
        toolCallName: 'create_entity'
      })
    );
    accumulator.consume(
      streamChunk({ type: 'TOOL_CALL_ARGS', toolCallId: 'call-a', delta: '{"name":"A"}' })
    );
    accumulator.consume(
      streamChunk({ type: 'TOOL_CALL_START', toolCallId: 'call-b', toolCallName: 'update_entity' })
    );
    accumulator.consume(
      streamChunk({ type: 'TOOL_CALL_ARGS', toolCallId: 'call-b', delta: '{"name":"B"}' })
    );
    accumulator.consume(
      streamChunk({
        type: 'TOOL_CALL_RESULT',
        messageId: 'message-b',
        toolCallId: 'call-b',
        content: 'updated'
      })
    );
    accumulator.consume(
      streamChunk({
        type: 'TOOL_CALL_RESULT',
        messageId: 'message-a',
        toolCallId: 'call-a',
        content: 'created'
      })
    );

    expect(accumulator.getCalls()).toEqual([
      { name: 'create_entity', args: '{"name":"A"}', result: 'created' },
      { name: 'update_entity', args: '{"name":"B"}', result: 'updated' }
    ]);
  });

  it('uses parsed input from TOOL_CALL_END when argument deltas are absent', () => {
    const accumulator = createAiToolCallAccumulator();

    accumulator.consume(
      streamChunk({
        type: 'TOOL_CALL_START',
        toolCallId: 'call-1',
        toolName: 'delete_entity'
      })
    );
    accumulator.consume(
      streamChunk({
        type: 'TOOL_CALL_END',
        toolCallId: 'call-1',
        input: { id: 'entity-1' }
      })
    );

    expect(accumulator.getCalls()).toEqual([{ name: 'delete_entity', args: '{"id":"entity-1"}' }]);
  });

  it('does not replace streamed arguments with the parsed end input', () => {
    const accumulator = createAiToolCallAccumulator();

    accumulator.consume(
      streamChunk({ type: 'TOOL_CALL_START', toolCallId: 'call-1', toolCallName: 'create_entity' })
    );
    accumulator.consume(
      streamChunk({ type: 'TOOL_CALL_ARGS', toolCallId: 'call-1', delta: '{"name":"A"}' })
    );
    accumulator.consume(
      streamChunk({ type: 'TOOL_CALL_END', toolCallId: 'call-1', input: { name: 'A' } })
    );

    expect(accumulator.getCalls()).toEqual([{ name: 'create_entity', args: '{"name":"A"}' }]);
  });
});
