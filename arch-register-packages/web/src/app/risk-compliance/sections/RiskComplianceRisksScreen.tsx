import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { Title } from '../../../components/Title';
import { Chip } from '../../../components/Chip';
import { Table } from '../../../components/table/Table';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { resolveRiskComplianceConfig } from '../riskComplianceQueries';
import { RISK_RAIL_PATHS, RISK_RISKS_ID } from '../riskComplianceSections';
import { residualRiskBand, RESIDUAL_RISK_BAND_COLOR } from '../residualRiskBand';
import { RiskDrawer } from './RiskDrawer';
import styles from './RiskCompliancePlaceholderScreen.module.css';

/**
 * Minimal Risks register: a plain list of Risk entities that opens the shared `RiskDrawer` on
 * row click, deep-linkable at `risk-compliance/risks/$riskId`. Proves the shared roll-up/drawer
 * model built in #3279 end-to-end with one real consumer — the register + 5×5 matrix are #3280's
 * job, not this one, mirroring how #3258's minimal `VendorVendorsScreen` preceded #3259.
 */
export const RiskComplianceRisksScreen = () => {
  const { workspaceSlug, riskId } = useParams({ strict: false }) as {
    workspaceSlug: string;
    riskId?: string;
  };
  const navigate = useNavigate();
  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const riskConfig = resolveRiskComplianceConfig(configurations.data);

  const risks = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: riskConfig?.riskSchemaId, view: 'full', limit: 500 },
      riskConfig != null
    )
  );

  const openRisk = (id: string) =>
    navigate({
      to: `${RISK_RAIL_PATHS[RISK_RISKS_ID]}/$riskId`,
      params: { workspaceSlug, riskId: id },
      search: (previous: Record<string, unknown>) => previous
    });
  const closeRisk = () =>
    navigate({
      to: RISK_RAIL_PATHS[RISK_RISKS_ID],
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

  const items = risks.data?.items ?? [];

  return (
    <div className={styles.screen}>
      <Title title="Risks" chips={!risks.isLoading && <span>{items.length}</span>} />

      <Table.Root scroll stickyHeader>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Name</Table.HeaderCell>
            <Table.HeaderCell>Category</Table.HeaderCell>
            <Table.HeaderCell>Residual risk</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {items.length === 0 ? (
            <Table.EmptyRow colSpan={3}>
              {risks.isLoading ? 'Loading risks…' : 'No risks yet.'}
            </Table.EmptyRow>
          ) : (
            items.map(entity => {
              const band = residualRiskBand(
                typeof entity.residual_risk_score === 'number'
                  ? entity.residual_risk_score
                  : null
              );
              return (
                <Table.Row key={entity._uid} onClick={() => openRisk(entity._publicId)}>
                  <Table.NameCell title={entity._name} subtitle={entity._publicId} />
                  <Table.Cell>{typeof entity.category === 'string' ? entity.category : '—'}</Table.Cell>
                  <Table.Cell>
                    {band ? (
                      <Chip dot={RESIDUAL_RISK_BAND_COLOR[band]} tone="ghost">
                        {band}
                      </Chip>
                    ) : (
                      '—'
                    )}
                  </Table.Cell>
                </Table.Row>
              );
            })
          )}
        </Table.Body>
      </Table.Root>

      {riskId && (
        <RiskDrawer
          workspaceSlug={workspaceSlug}
          riskId={riskId}
          riskConfig={riskConfig}
          onClose={closeRisk}
        />
      )}
    </div>
  );
};
