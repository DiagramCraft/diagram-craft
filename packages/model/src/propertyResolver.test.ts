import { describe, expect, it } from 'vitest';
import { Defaults } from './diagramDefaults';
import { _test, type PropertySource } from './propertyResolver';

type TestProps = {
  value?: number;
  nested?: {
    left?: number;
    right?: number;
  };
  enabled?: boolean;
};

const defaults = new Defaults<TestProps>({
  value: 0,
  nested: { left: 0, right: 0 },
  enabled: false
});

const sources: ReadonlyArray<PropertySource<TestProps>> = [
  { type: 'default', mode: 'info-only' },
  {
    type: 'style',
    props: { value: 1, nested: { left: 1 } },
    id: 'style-1',
    mode: 'editing-and-rendering'
  },
  {
    type: 'ruleStyle',
    props: { nested: { right: 2 } },
    mode: 'editing-and-rendering'
  },
  {
    type: 'stored',
    props: { value: 3 },
    mode: 'editing-and-rendering'
  },
  {
    type: 'rule',
    props: { value: 4 },
    id: 'rule-1',
    mode: 'rendering'
  },
  {
    type: 'rule',
    props: { value: 5 },
    id: 'rule-2',
    mode: 'rendering'
  }
];

describe('property resolver', () => {
  it('resolves editing properties in order and excludes rendering-only sources', () => {
    expect(_test.resolveEditProps(sources)).toEqual({
      value: 3,
      nested: { left: 1, right: 2 }
    });
  });

  it('resolves rendering properties with defaults and rule precedence', () => {
    expect(_test.resolveRenderProps(sources, defaults)).toEqual({
      value: 5,
      nested: { left: 1, right: 2 },
      enabled: false
    });
  });

  it('resolves ordered property provenance and supports a caller default', () => {
    expect(_test.resolvePropsInfo(sources, defaults, 'value')).toEqual([
      { val: 0, type: 'default' },
      { val: 1, type: 'style', id: 'style-1' },
      { val: 3, type: 'stored' },
      { val: 4, type: 'rule', id: 'rule-1' },
      { val: 5, type: 'rule', id: 'rule-2' }
    ]);

    expect(_test.resolvePropsInfo(sources, defaults, 'enabled', true)).toEqual([
      { val: true, type: 'default' }
    ]);
  });

  it('uses original source values for provenance after normalization', () => {
    const normalizedSources: ReadonlyArray<PropertySource<TestProps>> = [
      { type: 'default', mode: 'info-only' },
      {
        type: 'style',
        props: { value: 1 },
        infoProps: { value: 2 },
        mode: 'editing-and-rendering'
      }
    ];

    expect(_test.resolveEditProps(normalizedSources)).toEqual({ value: 1 });
    expect(_test.resolvePropsInfo(normalizedSources, defaults, 'value')).toEqual([
      { val: 0, type: 'default' },
      { val: 2, type: 'style' }
    ]);
  });
});
