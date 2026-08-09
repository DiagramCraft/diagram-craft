import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  DashboardStory,
  StoryProviders,
  WORKSPACE,
  createStoryQueryClient,
  dashboardWidget
} from '../../markdown/mdx-components/blocks/StorybookHarness';
import { entityKeys } from '../../../queries/entities';

const listOptions = {
  schemaId: 'risk',
  owner: undefined,
  lifecycle: undefined,
  limit: 500
};

const storyQueryClient = createStoryQueryClient();
storyQueryClient.setQueryData(entityKeys.list(WORKSPACE, listOptions), {
  items: [
    {
      _uid: 'risk-1',
      _publicId: 'RISK-001',
      _name: 'Unpatched edge gateway',
      residual_risk_score: 20
    },
    { _uid: 'risk-2', _publicId: 'RISK-002', _name: 'Vendor data export', residual_risk_score: 12 },
    {
      _uid: 'risk-3',
      _publicId: 'RISK-003',
      _name: 'Shared admin credentials',
      residual_risk_score: 9
    },
    {
      _uid: 'risk-4',
      _publicId: 'RISK-004',
      _name: 'Legacy backup process',
      residual_risk_score: 4
    }
  ],
  total: 4
});

const meta = {
  title: 'Dashboard Widgets/TopEntities',
  parameters: {
    layout: 'padded'
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const TopRisksByScore: Story = {
  render: () => (
    <StoryProviders client={storyQueryClient}>
      <DashboardStory
        widgets={[
          dashboardWidget(
            'top-risks',
            'TopEntities',
            {
              schema: 'risk',
              fieldId: 'residual_risk_score',
              direction: 'desc',
              limit: 3,
              label: 'Top risks by score'
            },
            0,
            0,
            4,
            4
          )
        ]}
      />
    </StoryProviders>
  )
};
