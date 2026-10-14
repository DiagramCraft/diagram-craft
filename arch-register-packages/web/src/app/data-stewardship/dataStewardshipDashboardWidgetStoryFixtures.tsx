import type { QueryClient } from '@tanstack/react-query';
import type { GovernanceCase } from '@arch-register/api-types/governanceContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget
} from '../../sections/markdown/mdx-components/blocks/StorybookHarness';
import { governanceCasesQuery } from '../../queries/governance';
import { entityDetailQuery, entitiesQuery } from '../../queries/entities';

const SCHEMA_ID = 'story-data-entity-schema';
const casesQuery = { status: 'open', subjectType: 'entity' } as const;

const daysFromNow = (days: number) => new Date(Date.now() + days * 86400000).toISOString();

const CASES = [
  {
    id: 'case-overdue-1',
    caseKind: 'entity.change-case',
    subjectId: 'ds-1',
    payload: { kind: 'change-proposal', revisionId: 'rev-1' },
    dueAt: daysFromNow(-3)
  },
  {
    id: 'case-soon-2',
    caseKind: 'entity.deprecation',
    subjectId: 'ds-2',
    payload: { kind: 'deprecation' },
    dueAt: daysFromNow(4)
  },
  {
    id: 'case-later-3',
    caseKind: 'entity.change-case',
    subjectId: 'ds-3',
    payload: { kind: 'change-proposal', revisionId: 'rev-3' },
    dueAt: daysFromNow(20)
  }
].map(entry => ({
  ...entry,
  subjectType: 'entity',
  status: 'open'
})) as unknown as GovernanceCase[];

const DATASETS = [
  { id: 'ds-1', name: 'Customer master', review: 'overdue' },
  { id: 'ds-2', name: 'Order events', review: 'ok' },
  { id: 'ds-3', name: 'Payment ledger', review: 'overdue' }
].map(({ id, name, review }) => ({
  _uid: id,
  _publicId: id.toUpperCase(),
  _name: name,
  _schema: { id: SCHEMA_ID, name: 'Data Entity' },
  review_status: review
})) as unknown as EntityRecord[];

export const seededDataStewardshipClient = ({
  cases = CASES
}: {
  cases?: GovernanceCase[];
} = {}): QueryClient => {
  const client = createStoryQueryClient();
  client.setQueryData(governanceCasesQuery(WORKSPACE, casesQuery).queryKey, cases);
  for (const dataset of DATASETS) {
    client.setQueryData(entityDetailQuery(WORKSPACE, dataset._uid).queryKey, dataset);
  }
  client.setQueryData(
    entitiesQuery(WORKSPACE, { schemaId: SCHEMA_ID, view: 'full', limit: 500 }).queryKey,
    { items: DATASETS, total: DATASETS.length }
  );
  return client;
};

export const dataStewardshipWidgetStory = (
  type: string,
  config: Record<string, unknown>,
  size: { w: number; h: number },
  options: { cases?: GovernanceCase[]; configured?: boolean } = {}
) => (
  <StoryProviders
    client={seededDataStewardshipClient({ cases: options.cases })}
    schemas={
      options.configured === false
        ? []
        : ([{ id: SCHEMA_ID, name: 'Data Entity', fields: [] }] as unknown as Parameters<
            typeof StoryProviders
          >[0]['schemas'])
    }
  >
    <DashboardStory widgets={[dashboardWidget(type, type, config, 0, 0, size.w, size.h)]} />
  </StoryProviders>
);
