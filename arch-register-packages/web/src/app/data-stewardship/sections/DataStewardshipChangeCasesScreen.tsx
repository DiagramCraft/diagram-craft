import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { Title } from '../../../components/Title';
import { SearchInput } from '../../../components/SearchInput';
import { Chip } from '../../../components/Chip';
import { Table } from '../../../components/table/Table';
import { usePrincipalLabel, type PrincipalValue } from '../../../hooks/usePrincipalLabel';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { formatDate } from '../../../utils/dateFormat';
import { caseKindLabel } from '../../../utils/governanceCaseLabels';
import { resolveDataStewardshipConfig } from '../dataStewardshipQueries';
import { DS_CHANGE_CASES_ID, DS_RAIL_PATHS } from '../dataStewardshipSections';
import { useDataStewardshipChangeCases } from '../dataStewardshipChangeCases';
import { DatasetDrawer } from './DatasetDrawer';
import { DataStewardshipCaseDrawer } from './DataStewardshipCaseDrawer';
import type { DataStewardshipChangeCasesSearchParams } from '../../../routes/searchParams';
import filterStyles from '../../../sections/entities/components/EntityBrowser.module.css';
import styles from './DataStewardshipStewardshipScreen.module.css';

const DANGER = 'var(--cmp-fg-danger, #ef4444)';
const WARN = 'var(--cmp-fg-warning, #eab308)';

const RISK_TONE: Record<string, string | undefined> = {
  high: DANGER,
  medium: WARN,
  low: undefined
};

const RISK_LABEL: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Low' };

/**
 * The Change cases & exceptions section (#3301) — currently just "Change cases": a read list over
 * the existing `entity.change-case` governance-case machinery (`useDataStewardshipChangeCases`) —
 * no new case kind, no new workflow, scoped to cases against Data Entities. Its drawer
 * (`DataStewardshipCaseDrawer.tsx`) is the same shared, already-shipped drawer #3298's My Work
 * queue uses; a viewer who happens to hold an open assignment on a case sees the same
 * Approve/Acknowledge/Request-changes actions there as in the workspace-wide Governance Inbox —
 * this screen doesn't add a second, separate action surface.
 *
 * The exceptions/waiver register the issue also called for was removed after review — see git
 * history for the removed schema/UI if it's revisited.
 *
 * This section's rail icon is only shown when the configured Data Entity schema actually has its
 * `entity.change-case` approval workflow enabled (`WorkspaceLayout.tsx`'s `visibleRailItems`) —
 * without it, no entity.change-case governance cases are ever created for the schema, so there is
 * no in-screen gating/notice here; a direct navigation while it's disabled just shows an
 * (always-empty) register.
 */
export const DataStewardshipChangeCasesScreen = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as DataStewardshipChangeCasesSearchParams;
  const q = search.q?.trim().toLowerCase() ?? '';

  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const dataStewardshipConfig = resolveDataStewardshipConfig(configurations.data);
  const principalLabel = usePrincipalLabel();

  const changeCases = useDataStewardshipChangeCases(
    workspaceSlug,
    dataStewardshipConfig?.dataEntitySchemaId ?? null
  );

  const patchSearch = (patch: Partial<DataStewardshipChangeCasesSearchParams>) =>
    navigate({
      to: DS_RAIL_PATHS[DS_CHANGE_CASES_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  const openCase = (caseId: string) => patchSearch({ caseId });
  const closeCase = () => patchSearch({ caseId: undefined });
  const openDataset = (datasetId: string) => patchSearch({ datasetId });
  const closeDataset = () => patchSearch({ datasetId: undefined });

  if (configurations.isLoading) {
    return <div className={styles.empty}>Loading data stewardship…</div>;
  }
  if (!dataStewardshipConfig) {
    return (
      <div className={styles.empty}>
        Data stewardship is not enabled. Configure the data stewardship capability in workspace
        settings.
      </div>
    );
  }

  const filteredCases = changeCases.rows.filter(row => {
    if (search.status && row.case.status !== search.status) return false;
    if (!q) return true;
    return `${row.dataset._name} ${row.dataset._publicId} ${row.requesterName ?? ''}`
      .toLowerCase()
      .includes(q);
  });

  return (
    <div className={styles.screen}>
      <Title
        title="Change cases & exceptions"
        chips={!changeCases.isLoading && <span>{filteredCases.length}</span>}
        description="Change proposals against governed datasets."
      />

      <div className={filterStyles.toolbar}>
        <SearchInput
          size="sm"
          className={filterStyles.searchInline}
          value={search.q ?? ''}
          placeholder="Search datasets, requesters…"
          aria-label="Search"
          onChange={value => patchSearch({ q: value || undefined })}
          onClear={() => patchSearch({ q: undefined })}
        />
      </div>

      <Table.Root scroll stickyHeader>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Kind</Table.HeaderCell>
            <Table.HeaderCell>Dataset</Table.HeaderCell>
            <Table.HeaderCell>Requester</Table.HeaderCell>
            <Table.HeaderCell>Steward</Table.HeaderCell>
            <Table.HeaderCell>Risk</Table.HeaderCell>
            <Table.HeaderCell>Raised</Table.HeaderCell>
            <Table.HeaderCell>Due</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {filteredCases.length === 0 ? (
            <Table.EmptyRow colSpan={8}>
              {changeCases.isLoading
                ? 'Loading change cases…'
                : 'No change cases match these filters.'}
            </Table.EmptyRow>
          ) : (
            filteredCases.map(row => (
              <Table.Row key={row.case.id} onClick={() => openCase(row.case.id)}>
                <Table.Cell>{caseKindLabel(row.case.caseKind, row.case.payload)}</Table.Cell>
                <Table.NameCell title={row.dataset._name} subtitle={row.dataset._publicId} />
                <Table.Cell className={row.requesterName == null ? 'dim' : undefined}>
                  {row.requesterName ?? 'unknown'}
                </Table.Cell>
                <Table.Cell className={row.dataset.steward == null ? 'dim' : undefined}>
                  {principalLabel(row.dataset.steward as PrincipalValue) ?? 'unassigned'}
                </Table.Cell>
                <Table.Cell>
                  <Chip tone="ghost" color={RISK_TONE[row.risk]}>
                    {RISK_LABEL[row.risk]}
                  </Chip>
                </Table.Cell>
                <Table.Cell>{formatDate(row.case.createdAt)}</Table.Cell>
                <Table.Cell>{formatDate(row.case.dueAt)}</Table.Cell>
                <Table.Cell>
                  <Chip tone="ghost">{row.case.status}</Chip>
                </Table.Cell>
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table.Root>

      {search.caseId && (
        <DataStewardshipCaseDrawer
          workspaceSlug={workspaceSlug}
          caseId={search.caseId}
          onClose={closeCase}
          onOpenDataset={datasetId => {
            closeCase();
            openDataset(datasetId);
          }}
        />
      )}
      {search.datasetId && (
        <DatasetDrawer
          workspaceSlug={workspaceSlug}
          datasetId={search.datasetId}
          onClose={closeDataset}
          onOpenCase={caseId => {
            closeDataset();
            openCase(caseId);
          }}
        />
      )}
    </div>
  );
};
