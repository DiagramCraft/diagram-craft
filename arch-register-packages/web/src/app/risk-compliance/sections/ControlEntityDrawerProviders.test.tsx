import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { EntityDrawerProviderContext } from '../../../sections/entities/entityDrawer/EntityDrawerProviderRegistry';
import { riskComplianceEntityDrawerProviderDefinitions } from './ControlEntityDrawerProviders';

const context = (overrides: Partial<EntityDrawerProviderContext> = {}) =>
  ({
    workspaceId: 'workspace-1',
    entity: { _uid: 'control-1' },
    schema: {
      id: 'control',
      name: 'Control',
      fields: [
        {
          id: 'mitigated_risks',
          name: 'Mitigated Risks',
          type: 'typedRelation',
          relationSchemaId: 'risk-control'
        },
        {
          id: 'protected_entities',
          name: 'Protected Entities',
          type: 'typedRelation',
          relationSchemaId: 'control-affects'
        }
      ]
    },
    schemas: [],
    relationSchemas: [],
    relations: { outgoing: [], incoming: [] },
    typedRelations: { outgoing: [], incoming: [] },
    typedRelationsStatus: { isLoading: false, isError: false },
    openEntity: vi.fn(),
    ...overrides
  }) as unknown as EntityDrawerProviderContext;

const item = (slotId: string) => ({ kind: 'slot' as const, slotId });

describe('risk compliance entity drawer providers', () => {
  it('renders mitigated risks from the configured relation field and preserves relation values', () => {
    const provider = riskComplianceEntityDrawerProviderDefinitions[0]!;
    const markup = renderToStaticMarkup(
      <provider.Component
        context={context({
          typedRelations: {
            outgoing: [
              {
                _uid: 'risk-control-1',
                _schema: { id: 'risk-control', name: 'Risk Mitigation' },
                _in: { id: 'risk-1', name: 'Account Takeover' },
                _out: { id: 'control-1', name: 'MFA Enforcement' },
                coverage: 75,
                effectiveness: 'partial'
              },
              {
                _uid: 'other-1',
                _schema: { id: 'other', name: 'Other' },
                _in: { id: 'risk-2', name: 'Other Risk' },
                _out: { id: 'control-1', name: 'MFA Enforcement' }
              }
            ],
            incoming: []
          } as unknown as EntityDrawerProviderContext['typedRelations']
        })}
        item={item(provider.slotId)}
        label="Risks mitigated"
      />
    );

    expect(markup).toContain('Account Takeover');
    expect(markup).toContain('75% · partial');
    expect(markup).not.toContain('Other Risk');
  });

  it('renders the empty state and loading state for protected entities', () => {
    const provider = riskComplianceEntityDrawerProviderDefinitions[1]!;
    const emptyMarkup = renderToStaticMarkup(
      <provider.Component
        context={context()}
        item={item(provider.slotId)}
        label="Protected entities"
      />
    );
    expect(emptyMarkup).toContain('No protected entities linked.');

    const loadingMarkup = renderToStaticMarkup(
      <provider.Component
        context={context({ typedRelationsStatus: { isLoading: true, isError: false } })}
        item={item(provider.slotId)}
        label="Protected entities"
      />
    );
    expect(loadingMarkup).toContain('Loading…');
  });

  it('only supports slots whose relation fields exist on the schema', () => {
    const withoutProtection = context({
      schema: {
        id: 'control',
        name: 'Control',
        fields: [
          {
            id: 'mitigated_risks',
            name: 'Mitigated Risks',
            type: 'typedRelation',
            relationSchemaId: 'risk-control'
          }
        ]
      } as EntityDrawerProviderContext['schema']
    });

    expect(riskComplianceEntityDrawerProviderDefinitions[0]!.supports(withoutProtection)).toBe(
      true
    );
    expect(riskComplianceEntityDrawerProviderDefinitions[1]!.supports(withoutProtection)).toBe(
      false
    );
  });
});
