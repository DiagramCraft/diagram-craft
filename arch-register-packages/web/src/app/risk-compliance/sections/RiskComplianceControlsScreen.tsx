import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { Title } from '../../../components/Title';
import { Table } from '../../../components/table/Table';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { resolveRiskComplianceConfig } from '../riskComplianceQueries';
import { RISK_RAIL_PATHS, RISK_CONTROLS_ID } from '../riskComplianceSections';
import { ControlDrawer } from './ControlDrawer';
import styles from './RiskCompliancePlaceholderScreen.module.css';

/**
 * Minimal Controls library: a plain list of Control entities that opens the shared
 * `ControlDrawer` on row click, deep-linkable at `risk-compliance/controls/$controlId`. Proves
 * the shared roll-up/drawer model built in #3279 end-to-end with one real consumer — the full
 * library/coverage view and traceability matrix are #3281/#3282's job, not this one.
 */
export const RiskComplianceControlsScreen = () => {
  const { workspaceSlug, controlId } = useParams({ strict: false }) as {
    workspaceSlug: string;
    controlId?: string;
  };
  const navigate = useNavigate();
  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const riskConfig = resolveRiskComplianceConfig(configurations.data);

  const controls = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: riskConfig?.controlSchemaId ?? undefined, view: 'full', limit: 500 },
      riskConfig?.controlSchemaId != null
    )
  );

  const openControl = (id: string) =>
    navigate({
      to: `${RISK_RAIL_PATHS[RISK_CONTROLS_ID]}/$controlId`,
      params: { workspaceSlug, controlId: id },
      search: (previous: Record<string, unknown>) => previous
    });
  const closeControl = () =>
    navigate({
      to: RISK_RAIL_PATHS[RISK_CONTROLS_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => previous
    });

  if (configurations.isLoading) {
    return <div className={styles.empty}>Loading risk & compliance…</div>;
  }
  if (!riskConfig) {
    return (
      <div className={styles.empty}>
        Risk & Compliance is not enabled. Configure the risk-compliance capability in workspace
        settings.
      </div>
    );
  }
  if (!riskConfig.controlSchemaId) {
    return <div className={styles.empty}>No Control entity schema is bound to this workspace.</div>;
  }

  const items = controls.data?.items ?? [];

  return (
    <div className={styles.screen}>
      <Title title="Controls" chips={!controls.isLoading && <span>{items.length}</span>} />

      <Table.Root scroll stickyHeader>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Name</Table.HeaderCell>
            <Table.HeaderCell>Type</Table.HeaderCell>
            <Table.HeaderCell>Operating effectiveness</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {items.length === 0 ? (
            <Table.EmptyRow colSpan={3}>
              {controls.isLoading ? 'Loading controls…' : 'No controls yet.'}
            </Table.EmptyRow>
          ) : (
            items.map(entity => (
              <Table.Row key={entity._uid} onClick={() => openControl(entity._publicId)}>
                <Table.NameCell title={entity._name} subtitle={entity._publicId} />
                <Table.Cell>
                  {typeof entity.control_type === 'string' ? entity.control_type : '—'}
                </Table.Cell>
                <Table.Cell>
                  {typeof entity.operating_effectiveness === 'string'
                    ? entity.operating_effectiveness
                    : '—'}
                </Table.Cell>
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table.Root>

      {controlId && (
        <ControlDrawer
          workspaceSlug={workspaceSlug}
          controlId={controlId}
          riskConfig={riskConfig}
          onClose={closeControl}
        />
      )}
    </div>
  );
};
