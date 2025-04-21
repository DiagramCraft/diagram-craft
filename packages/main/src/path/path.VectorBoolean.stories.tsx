import type { Meta, StoryObj } from '@storybook/react';
import { TEST_CASES } from '@diagram-craft/geometry/pathClip.testCases';
import { BooleanTest } from './BooleanTest';

const meta = {
  title: 'Geometry/Path/VectorBoolean',
  component: BooleanTest,
  parameters: {
    layout: 'centered'
  },
  argTypes: {}
} satisfies Meta<typeof BooleanTest>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CircleOverlappingRectangle: Story = {
  args: TEST_CASES.CircleOverlappingRectangle()
};

export const CircleInRectangle: Story = {
  args: TEST_CASES.CircleInRectangle()
};

export const RectangleInCircle: Story = {
  args: TEST_CASES.RectangleInCircle()
};
