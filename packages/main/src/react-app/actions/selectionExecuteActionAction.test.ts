import { beforeEach, describe, expect, test, vi } from 'vitest';
import { SelectionExecuteAction } from './selectionExecuteActionAction';
import { TestDiagramBuilder, TestModel } from '@diagram-craft/model/test-support/testModel';
import type { Application } from '../../application';
import type { DialogCommand } from '@diagram-craft/canvas/context';
import type { ResolvedNodeAction } from '@diagram-craft/model/nodeActions';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

type TestApplication = Application & {
  lastDialog?: DialogCommand<unknown, unknown>;
};

describe('SelectionExecuteAction', () => {
  let app: TestApplication;
  let openSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    openSpy = vi.fn();
    // biome-ignore lint/suspicious/noExplicitAny: test-only window shim
    (globalThis as any).window = { open: openSpy };

    const document = TestModel.newDocument();
    const diagram = new TestDiagramBuilder(document, 'diagram-1');
    const layer = diagram.newLayer();
    const secondDiagram = new TestDiagramBuilder(document, 'diagram-2');
    secondDiagram.newLayer();

    document.addDiagram(diagram);
    document.addDiagram(secondDiagram);

    app = {
      model: {
        activeDocument: document,
        activeDiagram: diagram,
        // biome-ignore lint/suspicious/noExplicitAny: test mock
        on: (_event: any, _handler: any, _options?: any) => {}
      },
      ui: {
        showDialog: (command: DialogCommand<unknown, unknown>) => {
          app.lastDialog = command;
        }
      }
      // biome-ignore lint/suspicious/noExplicitAny: test mock
    } as any;

    const node = layer.addNode({
      id: 'node-1',
      props: {
        actions: {
          first: {
            label: 'Open docs',
            type: 'url',
            url: 'https://example.com/docs'
          }
        }
      }
    });
    diagram.selection.setElements([node]);
  });

  test('executes the only available node action directly', () => {
    const action = new SelectionExecuteAction(app);

    action.execute({});

    expect(openSpy).toHaveBeenCalledWith('https://example.com/docs', '_blank');
    expect(app.lastDialog).toBeUndefined();
  });

  test('shows a chooser when multiple actions are available', () => {
    const node = app.model.activeDiagram.nodeLookup.get('node-1')!;
    UnitOfWork.execute(app.model.activeDiagram, uow => {
      node.updateProps(props => {
        props.actions = {
          first: {
            label: 'Open docs',
            type: 'url',
            url: 'https://example.com/docs'
          },
          second: {
            label: 'Go to Diagram 2',
            type: 'diagram',
            url: 'diagram-2'
          }
        };
      }, uow);
    });
    app.model.activeDiagram.selection.setElements([node]);

    const action = new SelectionExecuteAction(app);
    action.execute({});

    expect(app.lastDialog?.id).toBe('nodeActionChooser');
    const chooser = app.lastDialog!;
    expect((chooser.props as { actions: ResolvedNodeAction[] }).actions).toHaveLength(2);

    chooser.onOk({
      id: 'second',
      label: 'Go to Diagram 2',
      type: 'diagram',
      url: 'diagram-2'
    });

    expect(app.model.activeDiagram.id).toBe('diagram-2');
  });
});
