import type { Meta, StoryObj } from '@storybook/react';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { TEST_CASES } from '@diagram-craft/geometry/pathClip.fixtures';
import { Scale, Translation } from '@diagram-craft/geometry/transform';
import { _p } from '@diagram-craft/geometry/point';
import { BooleanTest } from './BooleanTest';

const meta = {
  title: 'Geometry/Path/boolean',
  component: BooleanTest,
  parameters: {
    layout: 'centered'
  },
  argTypes: {}
} satisfies Meta<typeof BooleanTest>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    p1: PathListBuilder.fromString(
      'M 0.1865,0.0781 C 0.3899,0.1569,0.6487,-0.0614,0.8521,0.0174 L 1,1 L 0.2604,1 C 0.242,0.7695,-0.2645,0.4693,0.1865,0.0781'
    ).setTransform([new Translation(_p(-0.3, -0.3)), new Scale(100, 100)]),
    p2: PathListBuilder.fromString(
      'M -0.6,-0.6 L 0.1539,-0.6 C 0.201,-0.35,0.5308,-0.4143,0.3424,0.4 C 0.1068,0.3601,-0.4356,0.2802,-0.6,0.2403 L -0.6,-0.6'
    ).setTransform([new Scale(100, 100)])
  }
};

export const OnEdge: Story = {
  args: TEST_CASES._OnEdge()
};

export const OnEdge2: Story = {
  args: TEST_CASES._OnEdge2()
};

export const NonIntersecting: Story = {
  args: TEST_CASES._NonIntersecting()
};

export const CircleInRectangleInverted: Story = {
  args: TEST_CASES._CircleInRectangleInverted()
};
