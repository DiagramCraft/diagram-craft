import type { Meta, StoryObj } from '@storybook/react-vite';
import { FoldableSection } from './FoldableSection';
import { StoryProviders } from '../../shared/mdx/StorybookHarness';

const meta = {
  title: 'Widgets/Content & layout/Foldable section',
  tags: ['mdx', 'block'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A collapsible section with a summary label. The content stays hidden until the reader expands it, which keeps long reference material (notes, appendices, full tables) out of the way of the main narrative. Available in wiki pages only.'
      }
    }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WikiArchitectureNotes: Story = {
  render: () => (
    <StoryProviders>
      <FoldableSection label="Architecture notes">
        <p>This service owns payment authorization and communicates with the ledger.</p>
        <ul>
          <li>Availability target: 99.9%</li>
          <li>Owner: Platform team</li>
        </ul>
      </FoldableSection>
    </StoryProviders>
  )
};

export const WikiDefaultLabel: Story = {
  render: () => (
    <StoryProviders>
      <FoldableSection>
        <p>Content is collapsed behind the default Details label.</p>
      </FoldableSection>
    </StoryProviders>
  )
};
