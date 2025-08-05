import type { Meta, StoryObj } from '@storybook/react';
import { TEST_CASES } from '@diagram-craft/geometry/pathClip.fixtures';
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

export const CircleOnRectangle: Story = {
  args: TEST_CASES.CircleOnRectangle()
};

export const RectOverRectWithHole: Story = {
  args: TEST_CASES.RectOverRectWithHole()
};

export const CircleOverTwoRects: Story = {
  args: TEST_CASES.CircleOverTwoRects()
};

export const CircleOverCircle: Story = {
  args: TEST_CASES.CircleOverCircle()
};

export const ComplexShapes: Story = {
  args: TEST_CASES.ComplexShapes()
};

export const ComplexShapes2: Story = {
  args: TEST_CASES.ComplexShapes2()
};

export const TriangleInsideRectangle: Story = {
  args: TEST_CASES.TriangleInsideRectangle()
};

export const DiamondOverlappingRectangle: Story = {
  args: TEST_CASES.DiamondOverlappingRectangle()
};

export const DiamondInsideRectangle: Story = {
  args: TEST_CASES.DiamondInsideRectangle()
};

export const NonOverlappingContours: Story = {
  args: TEST_CASES.NonOverlappingContours()
};

export const MoreNonOverlappingContours: Story = {
  args: TEST_CASES.MoreNonOverlappingContours()
};

export const ConcentricContours: Story = {
  args: TEST_CASES.ConcentricContours()
};

export const MoreConcentricContours: Story = {
  args: TEST_CASES.MoreConcentricContours()
};

export const CircleOverlappingHole: Story = {
  args: TEST_CASES.CircleOverlappingHole()
};
