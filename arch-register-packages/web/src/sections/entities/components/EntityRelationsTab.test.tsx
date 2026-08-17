import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DialogContextProvider } from '@diagram-craft/app-components/Dialog';

vi.mock('../../../components/EntityNavigationLink', () => ({
  EntityNavigationLink: ({
    publicId,
    children,
    ...props
  }: {
    publicId: string;
    children: React.ReactNode;
  }) => (
    <a href={`/entities/${publicId}`} {...props}>
      {children}
    </a>
  )
}));

const { EntityRelationsTab } = await import('./EntityRelationsTab');

describe('EntityRelationsTab', () => {
  it('renders a navigation-only relation row as an anchor', () => {
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <DialogContextProvider onDialogShow={() => {}} onDialogHide={() => {}}>
          <EntityRelationsTab
            workspaceId="ws-1"
            schemas={[]}
            relationSchemas={[]}
            typedRelationsOutgoing={[]}
            typedRelationsIncoming={[]}
            entityId="entity-current"
            entitySchemaId="schema-current"
            entityName="Current entity"
            incoming={[]}
            outgoing={[
              {
                entityId: 'entity-1',
                publicId: 'APP-42',
                entitySlug: 'payments-api',
                entityName: 'Payments API',
                entitySchemaId: 'schema-1',
                fieldName: 'uses',
                kind: 'reference'
              }
            ]}
          />
        </DialogContextProvider>
      </QueryClientProvider>
    );

    expect(markup).toContain('<a href="/entities/APP-42"');
    expect(markup).toContain('Payments API');
    expect(markup).not.toContain('<button');
  });
});
