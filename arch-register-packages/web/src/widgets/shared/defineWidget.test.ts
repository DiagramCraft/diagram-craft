import { describe, expect, it } from 'vitest';
import { defineWidget } from './defineWidget';

const baseDefinition = {
  type: 'NoIcon',
  category: 'data-views',
  name: 'No icon',
  description: 'Component without an icon',
  component: () => null
};

describe('defineWidget icon requirements', () => {
  it('requires an icon for dashboard widgets', () => {
    expect(() =>
      defineWidget({
        ...baseDefinition,
        dashboard: {}
      } as never)
    ).toThrow('Component "NoIcon" must define an icon for its catalog entry');
  });

  it('requires an icon for MDX slash commands', () => {
    expect(() =>
      defineWidget({
        ...baseDefinition,
        mdx: {
          editorSpec: { slashCommand: {} }
        }
      } as never)
    ).toThrow('Component "NoIcon" must define an icon for its catalog entry');
  });
});

describe('defineWidget config schema requirements', () => {
  it('requires a config schema for dashboard widgets', () => {
    expect(() =>
      defineWidget({
        ...baseDefinition,
        icon: () => null,
        dashboard: { defaultW: 1, defaultH: 1, surfaces: ['workspace'] }
      } as never)
    ).toThrow('Dashboard component "NoIcon" must define configSchema');
  });
});
