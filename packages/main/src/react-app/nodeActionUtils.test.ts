import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { executeNodeAction } from './nodeActionUtils';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import type { ResolvedNodeAction } from '@diagram-craft/model/nodeActions';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import type { Application } from '../application';
import type {
  TestDiagramBuilder,
  TestLayerBuilder
} from '@diagram-craft/model/test-support/testModel';

const mockApplication = (diagram: TestDiagramBuilder): Application => {
  return {
    model: {
      activeDocument: diagram.document,
      activeDiagram: diagram
    }
    // biome-ignore lint/suspicious/noExplicitAny: test mock
  } as any;
};

describe('executeNodeAction - rest', () => {
  let diagram: TestDiagramBuilder;
  let layer: TestLayerBuilder;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    diagram = TestModel.newDiagram();
    layer = diagram.newLayer();
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('posts element id, type and text to the configured URL', async () => {
    const node = layer.addNode({ id: 'node1', type: 'circle' });
    UnitOfWork.execute(diagram, uow => node.setText('Hello world', uow));

    const action: ResolvedNodeAction = {
      id: 'a1',
      label: 'Call webhook',
      type: 'rest',
      url: 'https://example.com/webhook'
    };

    executeNodeAction(mockApplication(diagram), action, node);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.com/webhook');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(options.body)).toEqual({
      id: 'node1',
      type: 'circle',
      text: 'Hello world'
    });
  });

  test('logs an error and does not throw when the request fails', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const node = layer.addNode({ id: 'node2', type: 'rect' });
    const action: ResolvedNodeAction = {
      id: 'a2',
      label: 'Call webhook',
      type: 'rest',
      url: 'https://example.com/webhook'
    };

    expect(() => executeNodeAction(mockApplication(diagram), action, node)).not.toThrow();

    await vi.waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
    expect(consoleErrorSpy).toHaveBeenCalledWith('REST call action failed', expect.any(Error));
  });

  test('logs an error when the response is not ok', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const node = layer.addNode({ id: 'node3', type: 'rect' });
    const action: ResolvedNodeAction = {
      id: 'a3',
      label: 'Call webhook',
      type: 'rest',
      url: 'https://example.com/webhook'
    };

    executeNodeAction(mockApplication(diagram), action, node);

    await vi.waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'REST call action failed: 500 Internal Server Error'
    );
  });

  test('does nothing when url is undefined', () => {
    const node = layer.addNode({ id: 'node4', type: 'rect' });
    const action: ResolvedNodeAction = {
      id: 'a4',
      label: 'Call webhook',
      type: 'rest',
      url: undefined
    };

    executeNodeAction(mockApplication(diagram), action, node);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
