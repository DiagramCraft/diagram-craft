// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntityDrawerStackProvider, useEntityDrawer } from './useEntityDrawer';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  historyBack: vi.fn(),
  historyGo: vi.fn(),
  search: {} as Record<string, unknown>
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useRouter: () => ({ history: { back: mocks.historyBack, go: mocks.historyGo } }),
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
    mocks.historyBack.mockReset();
    mocks.historyGo.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('pushes a child, restores its parent, and closes the root without adding history', async () => {
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
    expect(mocks.navigate).toHaveBeenCalledOnce();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button:nth-of-type(2)')?.click();
    });
    expect(container.querySelector('[data-testid="stack"]')?.textContent).toBe('CON-1/VND-1');
    expect(container.querySelector('[data-testid="active"]')?.textContent).toBe('1');

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button:nth-of-type(3)')?.click();
    });
    expect(container.querySelector('[data-testid="active"]')?.textContent).toBe('0');
    expect(mocks.historyBack).toHaveBeenCalledOnce();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button:nth-of-type(4)')?.click();
    });
    expect(container.querySelector('[data-testid="active"]')?.textContent).toBe('-1');
    expect(mocks.navigate).toHaveBeenLastCalledWith(
      expect.objectContaining({ replace: true, search: expect.any(Function) })
    );
  });
});
