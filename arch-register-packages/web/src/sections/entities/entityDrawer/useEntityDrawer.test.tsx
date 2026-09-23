// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntityDrawerStackProvider, useEntityDrawer } from './useEntityDrawer';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: {} as Record<string, unknown>
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useSearch: () => mocks.search
}));

const Probe = () => {
  const { drawerStack, activeDrawerIndex, openEntityDrawer, backEntityDrawer, closeEntityDrawer } =
    useEntityDrawer();

  return (
    <div>
      <output data-testid="stack">{drawerStack.map(entry => entry.entityId).join('/')}</output>
      <output data-testid="active">{activeDrawerIndex}</output>
      <button type="button" onClick={() => openEntityDrawer('CON-1')}>
        Contract
      </button>
      <button type="button" onClick={() => openEntityDrawer('VND-1')}>
        Vendor
      </button>
      <button type="button" onClick={backEntityDrawer}>
        Back
      </button>
      <button type="button" onClick={closeEntityDrawer}>
        Close
      </button>
    </div>
  );
};

describe('useEntityDrawer stack controller', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.search = {};
    mocks.navigate.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('pushes and pops a child stack entry without ever touching the URL', async () => {
    await act(async () => {
      root.render(
        <EntityDrawerStackProvider>
          <Probe />
        </EntityDrawerStackProvider>
      );
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button:nth-of-type(1)')?.click();
    });
    expect(container.querySelector('[data-testid="stack"]')?.textContent).toBe('CON-1');
    expect(mocks.navigate).not.toHaveBeenCalled();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button:nth-of-type(2)')?.click();
    });
    expect(container.querySelector('[data-testid="stack"]')?.textContent).toBe('CON-1/VND-1');
    expect(container.querySelector('[data-testid="active"]')?.textContent).toBe('1');
    expect(mocks.navigate).not.toHaveBeenCalled();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button:nth-of-type(3)')?.click();
    });
    expect(container.querySelector('[data-testid="active"]')?.textContent).toBe('0');
    expect(mocks.navigate).not.toHaveBeenCalled();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button:nth-of-type(4)')?.click();
    });
    expect(container.querySelector('[data-testid="active"]')?.textContent).toBe('-1');
    // This drawer was opened purely from in-app navigation (the URL never had a `drawer` param
    // for it), so closing it doesn't touch the URL either.
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('clears a stale `drawer` search param when closing a drawer that arrived via a shared link', async () => {
    mocks.search = { drawer: 'CON-1' };

    await act(async () => {
      root.render(
        <EntityDrawerStackProvider>
          <Probe />
        </EntityDrawerStackProvider>
      );
    });
    expect(container.querySelector('[data-testid="stack"]')?.textContent).toBe('CON-1');

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button:nth-of-type(4)')?.click();
    });
    expect(container.querySelector('[data-testid="active"]')?.textContent).toBe('-1');
    expect(mocks.navigate).toHaveBeenCalledOnce();
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ replace: true, search: expect.any(Function) })
    );
  });
});
