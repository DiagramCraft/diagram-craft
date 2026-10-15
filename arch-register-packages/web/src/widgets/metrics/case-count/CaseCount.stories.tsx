import type { Meta, StoryObj } from "@storybook/react-vite";
import type { GovernanceCase } from "@arch-register/api-types/governanceContract";
import type { EntityRecord } from "@arch-register/api-types/entityContract";
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget,
} from "../../shared/mdx/StorybookHarness";
import { entityDetailQuery } from "../../../queries/entities";
import { governanceCasesQuery } from "../../../queries/governance";

const SCHEMA_ID = "story-data-entity";
const casesQuery = { status: "open", subjectType: "entity" } as const;

const daysFromNow = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString();

const CASES = [
  ["case-1", "entity.change-case", -3],
  ["case-2", "entity.deprecation", 2],
  ["case-3", "entity.change-case", 30],
].map(([id, caseKind, days], index) => ({
  id,
  caseKind,
  subjectType: "entity",
  subjectId: `dataset-${index}`,
  status: "open",
  payload: {},
  dueAt: daysFromNow(days as number),
})) as unknown as GovernanceCase[];

const render = (
  config: Record<string, unknown>,
  cases: GovernanceCase[] = CASES,
) => {
  const client = createStoryQueryClient();
  client.setQueryData(
    governanceCasesQuery(WORKSPACE, casesQuery).queryKey,
    cases,
  );
  cases.forEach((governanceCase) =>
    client.setQueryData(
      entityDetailQuery(WORKSPACE, governanceCase.subjectId).queryKey,
      {
        _uid: governanceCase.subjectId,
        _publicId: governanceCase.subjectId,
        _name: governanceCase.subjectId,
        _schema: { id: SCHEMA_ID, name: "Data Entity" },
      } as unknown as EntityRecord,
    ),
  );
  return (
    <StoryProviders client={client}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            "case-count",
            "CaseCount",
            {
              schema: SCHEMA_ID,
              caseKinds: ["entity.change-case", "entity.deprecation"],
              scope: "workspace",
              ...config,
            },
            0,
            0,
            3,
            5,
          ),
        ]}
      />
    </StoryProviders>
  );
};

const meta = {
  title: "Widgets/Metrics/Case count",
  tags: ["dashboard", "workspace-surface"],
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const AwaitingDecision: Story = {
  render: () =>
    render({
      label: "Cases awaiting a decision",
      tone: "warning",
      subtextTemplate: "{due} due within a week",
    }),
};

export const PastDue: Story = {
  render: () =>
    render({
      label: "Past due",
      scope: "late",
      tone: "danger",
      subtextTemplate: "across all assignees",
    }),
};

export const Empty: Story = {
  render: () =>
    render({ label: "Cases awaiting a decision", tone: "warning" }, []),
};
