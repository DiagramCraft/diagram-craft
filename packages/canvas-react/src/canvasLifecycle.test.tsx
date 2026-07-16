// @vitest-environment jsdom

import { act, createRef, StrictMode, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Context } from '@diagram-craft/canvas/context';
import {
  BaseCanvasComponent,
  type BaseCanvasProps
} from '@diagram-craft/canvas/canvas/BaseCanvasComponent';
import type { Actions } from '@diagram-craft/canvas/keyMap';
import * as html from '@diagram-craft/canvas/component/vdom-html';
import type { Props } from '@diagram-craft/canvas/canvas/EditableCanvasComponent';
import { Canvas } from './Canvas';
import { EditableCanvas } from './EditableCanvas';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const editableLifecycle = vi.hoisted(() => ({
  events: [] as string[]
}));

vi.mock('@diagram-craft/canvas/canvas/EditableCanvasComponent', () => {
  class RecordingEditableCanvasComponent {
    private svg: SVGSVGElement | null = null;

    attach(parent: HTMLElement, props: { id: string }) {
      editableLifecycle.events.push(`attach:${props.id}`);
      this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.svg.id = props.id;
      parent.appendChild(this.svg);
    }

    update(props: { id: string }) {
      editableLifecycle.events.push(`update:${props.id}`);
    }

    detach() {
      editableLifecycle.events.push('detach');
      this.svg?.remove();
      this.svg = null;
    }

    isRendered() {
      return this.svg !== null;
    }

    getSvgElement() {
      return this.svg!;
    }
  }

  return { EditableCanvasComponent: RecordingEditableCanvasComponent };
});

type TestCanvasProps = BaseCanvasProps & {
  value: string;
  onUpdated?: () => void;
};

const canvasLifecycle: string[] = [];

class RecordingCanvasComponent extends BaseCanvasComponent<TestCanvasProps> {
  protected defaultClassName = 'test-canvas';
  protected preserveAspectRatio = 'none';

  attach(parent: HTMLElement, props: TestCanvasProps) {
    canvasLifecycle.push(`attach:${props.value}`);
    super.attach(parent, props);
  }

  update(props: TestCanvasProps, force = false) {
    canvasLifecycle.push(`update:${props.value}:${force}`);
    props.onUpdated?.();
    super.update(props, force);
  }

  detach() {
    canvasLifecycle.push('detach');
    super.detach();
  }

  render(props: TestCanvasProps) {
    return html.svg({ id: props.id }, []);
  }
}

const context = {} as Context;
const diagram = {} as BaseCanvasProps['diagram'];
const canvasFactory = () => new RecordingCanvasComponent();

const canvasProps = (value: string, onUpdated?: () => void): TestCanvasProps => ({
  id: 'canvas',
  context,
  diagram,
  value,
  onUpdated
});

const editableProps = (id: string) =>
  ({
    id,
    context,
    diagram,
    offset: { x: 0, y: 0 },
    tools: {},
    actionMap: {},
    keyMap: {}
  }) as Props & Actions;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  canvasLifecycle.length = 0;
  editableLifecycle.events.length = 0;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Canvas lifecycle', () => {
  test('attaches, updates, detaches, and balances refs in Strict Mode', () => {
    const forwardedRef = createRef<SVGSVGElement>();

    act(() => {
      root.render(
        <StrictMode>
          <Canvas<RecordingCanvasComponent, TestCanvasProps>
            {...canvasProps('initial')}
            canvasFactory={canvasFactory}
            ref={forwardedRef}
          />
        </StrictMode>
      );
    });

    expect(canvasLifecycle).toEqual(['attach:initial', 'detach', 'attach:initial']);
    expect(forwardedRef.current).toBe(container.querySelector('svg'));

    canvasLifecycle.length = 0;
    act(() => {
      root.render(
        <StrictMode>
          <Canvas<RecordingCanvasComponent, TestCanvasProps>
            {...canvasProps('updated')}
            canvasFactory={canvasFactory}
            ref={forwardedRef}
          />
        </StrictMode>
      );
    });

    expect(canvasLifecycle).toEqual(['update:updated:true']);

    act(() => root.unmount());

    expect(canvasLifecycle).toEqual(['update:updated:true', 'detach']);
    expect(forwardedRef.current).toBeNull();
  });

  test('does not trigger React updates while rendering', () => {
    const errors: unknown[] = [];
    const consoleError = vi.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args);
    });
    let updated = false;

    const UpdatingCanvas = ({ value }: { value: string }) => {
      const [, setState] = useState(0);
      const hasUpdated = useRef(false);

      return (
        <Canvas<RecordingCanvasComponent, TestCanvasProps>
          {...canvasProps(value, () => {
            if (!hasUpdated.current) {
              hasUpdated.current = true;
              updated = true;
              setState(state => state + 1);
            }
          })}
          canvasFactory={canvasFactory}
        />
      );
    };

    act(() => root.render(<UpdatingCanvas value="initial" />));
    act(() => root.render(<UpdatingCanvas value="updated" />));

    expect(updated).toBe(true);
    expect(errors.flat().some(error => String(error).includes('Cannot update'))).toBe(false);
    consoleError.mockRestore();
  });

  test('recreates the component when the factory changes', () => {
    const firstFactory = () => new RecordingCanvasComponent();
    const secondFactory = () => new RecordingCanvasComponent();

    act(() => {
      root.render(
        <Canvas<RecordingCanvasComponent, TestCanvasProps>
          {...canvasProps('initial')}
          canvasFactory={firstFactory}
        />
      );
    });

    canvasLifecycle.length = 0;
    act(() => {
      root.render(
        <Canvas<RecordingCanvasComponent, TestCanvasProps>
          {...canvasProps('recreated')}
          canvasFactory={secondFactory}
        />
      );
    });

    expect(canvasLifecycle).toEqual(['detach', 'attach:recreated']);
  });
});

describe('EditableCanvas lifecycle', () => {
  test('attaches, updates, detaches, and balances refs in Strict Mode', () => {
    const forwardedRef = createRef<SVGSVGElement>();

    act(() => {
      root.render(
        <StrictMode>
          <EditableCanvas {...editableProps('editable-initial')} ref={forwardedRef} />
        </StrictMode>
      );
    });

    expect(editableLifecycle.events).toEqual([
      'attach:editable-initial',
      'detach',
      'attach:editable-initial'
    ]);
    expect(forwardedRef.current).toBe(container.querySelector('svg'));

    editableLifecycle.events.length = 0;
    act(() => {
      root.render(
        <StrictMode>
          <EditableCanvas {...editableProps('editable-updated')} ref={forwardedRef} />
        </StrictMode>
      );
    });

    expect(editableLifecycle.events).toEqual(['update:editable-updated']);

    act(() => root.unmount());

    expect(editableLifecycle.events).toEqual(['update:editable-updated', 'detach']);
    expect(forwardedRef.current).toBeNull();
  });
});
