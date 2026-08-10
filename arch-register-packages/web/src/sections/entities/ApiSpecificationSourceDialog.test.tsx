import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@diagram-craft/app-components/Dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null
}));

vi.mock('@diagram-craft/app-components/FormElement', () => ({
  FormElement: ({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) => (
    <label>
      {label}
      <span>{hint}</span>
      {children}
    </label>
  )
}));

const { ApiSpecificationSourceDialog } = await import('./ApiSpecificationSourceDialog');

describe('ApiSpecificationSourceDialog', () => {
  it('offers metadata-only links and fetchable HTTPS URL sources', () => {
    const markup = renderToStaticMarkup(
      <ApiSpecificationSourceDialog
        open
        onClose={vi.fn()}
        onCreate={vi.fn()}
        isPending={false}
      />
    );

    expect(markup).toContain('External link');
    expect(markup).toContain('no normalized operations');
    expect(markup).toContain('HTTPS URL');
    expect(markup).toContain('Fetch, validate, and refresh');
  });
});
