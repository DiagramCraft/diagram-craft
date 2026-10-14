import { describe, expect, it } from 'vitest';
import { defineComponent } from './defineComponent';

const baseDefinition = {
  type: 'NoIcon',
  category: 'data-views',
  name: 'No icon',
  description: 'Component without an icon',
  component: () => null
};

describe('defineComponent icon requirements', () => {
  it('requires an icon for dashboard widgets', () => {
    expect(() =>
      defineComponent({
        ...baseDefinition,
        dashboardWidget: {}
      } as never)
    ).toThrow('Component "NoIcon" must define an icon for its catalog entry');
  });

  it('requires an icon for MDX slash commands', () => {
    expect(() =>
      defineComponent({
        ...baseDefinition,
        mdxComponent: {
          editorSpec: { slashCommand: {} }
        }
      } as never)
    ).toThrow('Component "NoIcon" must define an icon for its catalog entry');
  });
});

describe('defineComponent config schema requirements', () => {
  it('requires a config schema for dashboard widgets', () => {
    expect(() =>
      defineComponent({
        ...baseDefinition,
        icon: () => null,
        dashboardWidget: { defaultW: 1, defaultH: 1, surfaces: ['workspace'] }
      } as never)
    ).toThrow('Dashboard component "NoIcon" must define configSchema');
  });
});
