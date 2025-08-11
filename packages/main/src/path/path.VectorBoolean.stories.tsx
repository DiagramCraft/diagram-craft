import type { Meta, StoryObj } from '@storybook/react';
import { VECTOR_BOOLEAN_TEST_CASES } from '@diagram-craft/geometry/pathClip.fixtures';
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
  args: VECTOR_BOOLEAN_TEST_CASES.CircleOverlappingRectangle()
};

export const CircleInRectangle: Story = {
  args: VECTOR_BOOLEAN_TEST_CASES.CircleInRectangle()
};

export const RectangleInCircle: Story = {
  args: VECTOR_BOOLEAN_TEST_CASES.RectangleInCircle()
};

export const CircleOnRectangle: Story = {
  args: VECTOR_BOOLEAN_TEST_CASES.CircleOnRectangle()
};

export const RectOverRectWithHole: Story = {
  args: VECTOR_BOOLEAN_TEST_CASES.RectOverRectWithHole()
};

export const CircleOverTwoRects: Story = {
  args: VECTOR_BOOLEAN_TEST_CASES.CircleOverTwoRects()
};

export const CircleOverCircle: Story = {
  args: VECTOR_BOOLEAN_TEST_CASES.CircleOverCircle()
};

export const ComplexShapes: Story = {
  args: VECTOR_BOOLEAN_TEST_CASES.ComplexShapes()
};

export const ComplexShapes2: Story = {
  args: VECTOR_BOOLEAN_TEST_CASES.ComplexShapes2()
};

export const TriangleInsideRectangle: Story = {
  args: VECTOR_BOOLEAN_TEST_CASES.TriangleInsideRectangle()
};

export const DiamondOverlappingRectangle: Story = {
  args: VECTOR_BOOLEAN_TEST_CASES.DiamondOverlappingRectangle()
};

export const DiamondInsideRectangle: Story = {
  args: VECTOR_BOOLEAN_TEST_CASES.DiamondInsideRectangle()
};

export const NonOverlappingContours: Story = {
  args: VECTOR_BOOLEAN_TEST_CASES.NonOverlappingContours()
};

export const MoreNonOverlappingContours: Story = {
  args: VECTOR_BOOLEAN_TEST_CASES.MoreNonOverlappingContours()
};

export const ConcentricContours: Story = {
  args: VECTOR_BOOLEAN_TEST_CASES.ConcentricContours()
};

export const MoreConcentricContours: Story = {
  args: VECTOR_BOOLEAN_TEST_CASES.MoreConcentricContours()
};

export const CircleOverlappingHole: Story = {
  args: VECTOR_BOOLEAN_TEST_CASES.CircleOverlappingHole()
};

export const RectWithHoleOverRectWithHole: Story = {
  args: VECTOR_BOOLEAN_TEST_CASES.RectWithHoleOverRectWithHole()
};

export const CurveOverlappingRect: Story = {
  args: VECTOR_BOOLEAN_TEST_CASES.CurveOverlappingRect()
};
