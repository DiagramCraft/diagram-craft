import type { Meta, StoryObj } from '@storybook/react';
import { VECTOR_BOOLEAN_DEBUG_TEST_CASES } from '@diagram-craft/geometry/pathClip.fixtures';
import { BooleanTest } from './BooleanTest';

const meta = {
  title: 'Geometry/Path/VectorBooleanDebug',
  component: BooleanTest,
  parameters: {
    layout: 'centered'
  },
  argTypes: {}
} satisfies Meta<typeof BooleanTest>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Debug: Story = {
  args: VECTOR_BOOLEAN_DEBUG_TEST_CASES.Debug()
};

export const DebugQuadCurve: Story = {
  args: VECTOR_BOOLEAN_DEBUG_TEST_CASES.DebugQuadCurve()
};
