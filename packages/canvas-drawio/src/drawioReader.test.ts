// @vitest-environment jsdom
import { describe, test, expect } from 'vitest';
import { _test } from './drawioReader';
import { StyleManager } from './styleManager';

describe('parseNodeProps', () => {
  test('sets default text properties for nodes', () => {
    const style = new StyleManager('');
    const props = _test.getNodeProps(style, false);

    expect(props.text?.fontSize).toBe(12);
    expect(props.text?.font).toBe('Helvetica');
    expect(props.text?.color).toBe('black');
    expect(props.text?.align).toBe('center');
    expect(props.text?.valign).toBe('middle');
  });

  test('sets default text properties for edges', () => {
    const style = new StyleManager('');
    const props = _test.getNodeProps(style, true);

    expect(props.text?.fontSize).toBe(11);
  });

  test('parses text alignment properties', () => {
    const style = new StyleManager('align=left;verticalAlign=top');
    const props = _test.getNodeProps(style, false);

    expect(props.text?.align).toBe('left');
    expect(props.text?.valign).toBe('top');
  });

  test('parses font properties', () => {
    const style = new StyleManager('fontFamily=Arial;fontColor=red;fontSize=16;fontStyle=3');
    const props = _test.getNodeProps(style, false);

    expect(props.text?.font).toBe('Arial');
    expect(props.text?.color).toBe('red');
    expect(props.text?.fontSize).toBe(16);
    expect(props.text?.bold).toBe(true);
    expect(props.text?.italic).toBe(true);
  });

  test('parses fill color', () => {
    const style = new StyleManager('fillColor=blue');
    const props = _test.getNodeProps(style, false);

    expect(props.fill?.color).toBe('blue');
  });

  test('parses gradient properties', () => {
    const style = new StyleManager('gradientColor=red;gradientDirection=north');
    const props = _test.getNodeProps(style, false);

    expect(props.fill?.type).toBe('gradient');
    expect(props.fill?.color2).toBe('red');
    expect(props.fill?.gradient?.type).toBe('linear');
    expect(props.fill?.gradient?.direction).toBe(-Math.PI / 2);
  });

  test('parses stroke properties', () => {
    const style = new StyleManager('strokeColor=green;strokeWidth=3');
    const props = _test.getNodeProps(style, false);

    expect(props.stroke?.color).toBe('green');
    expect(props.stroke?.width).toBe(3);
  });

  test('parses dashed stroke pattern', () => {
    const style = new StyleManager('dashed=1;dashPattern=8 4;strokeWidth=2');
    const props = _test.getNodeProps(style, false);

    expect(props.stroke?.pattern).toBe('DASHED');
    expect(props.stroke?.patternSpacing).toBe(80);
    expect(props.stroke?.patternSize).toBe(160);
  });

  test('parses opacity effect', () => {
    const style = new StyleManager('opacity=50');
    const props = _test.getNodeProps(style, false);

    expect(props.effects?.opacity).toBe(0.5);
  });

  test('parses sketch effect', () => {
    const style = new StyleManager('sketch=1');
    const props = _test.getNodeProps(style, false);

    expect(props.effects?.sketch).toBe(true);
    expect(props.effects?.sketchFillType).toBe('hachure');
  });

  test('parses glass effect', () => {
    const style = new StyleManager('glass=1');
    const props = _test.getNodeProps(style, false);

    expect(props.effects?.glass).toBe(true);
  });

  test('parses rounded effect', () => {
    const style = new StyleManager('rounded=1;arcSize=10');
    const props = _test.getNodeProps(style, false);

    expect(props.effects?.rounding).toBe(true);
    expect(props.effects?.roundingAmount).toBe(10);
  });

  test('parses shadow effect', () => {
    const style = new StyleManager('shadow=1');
    const props = _test.getNodeProps(style, false);

    expect(props.shadow?.enabled).toBe(true);
    expect(props.shadow?.color).toBe('#999999');
    expect(props.shadow?.x).toBe(3);
    expect(props.shadow?.y).toBe(3);
    expect(props.shadow?.blur).toBe(3);
  });

  test('parses geometry flip properties', () => {
    const style = new StyleManager('shape=rect;flipH=1;flipV=1');
    const props = _test.getNodeProps(style, false);

    expect(props.geometry?.flipH).toBe(true);
    expect(props.geometry?.flipV).toBe(true);
  });

  test('parses capability properties', () => {
    const style = new StyleManager('rotatable=0;resizable=0;movable=0;editable=0;deletable=0');
    const props = _test.getNodeProps(style, false);

    expect(props.capabilities?.rotatable).toBe(false);
    expect(props.capabilities?.resizable).toEqual({ vertical: false, horizontal: false });
    expect(props.capabilities?.movable).toBe(false);
    expect(props.capabilities?.editable).toBe(false);
    expect(props.capabilities?.deletable).toBe(false);
  });

  test('parses indicator properties', () => {
    const style = new StyleManager(
      'indicatorShape=ellipse;indicatorColor=red;indicatorDirection=north;indicatorWidth=15;indicatorHeight=20'
    );
    const props = _test.getNodeProps(style, false);

    expect(props.indicators?._default?.enabled).toBe(true);
    expect(props.indicators?._default?.shape).toBe('disc');
    expect(props.indicators?._default?.color).toBe('red');
    expect(props.indicators?._default?.direction).toBe('n');
    expect(props.indicators?._default?.width).toBe(15);
    expect(props.indicators?._default?.height).toBe(20);
  });

  test('parses routing constraint', () => {
    const style = new StyleManager('portConstraint=north');
    const props = _test.getNodeProps(style, false);

    expect(props.routing?.constraint).toBe('n');
  });

  test('parses perimeter spacing', () => {
    const style = new StyleManager('perimeterSpacing=5');
    const props = _test.getNodeProps(style, false);

    expect(props.routing?.spacing).toBe(5);
  });
});

describe('readMetadata', () => {
  const createElement = (attributes: Record<string, string>): HTMLElement => {
    const parser = new DOMParser();
    const doc = parser.parseFromString('<element/>', 'text/xml');
    const element = doc.documentElement as unknown as HTMLElement;
    for (const [key, value] of Object.entries(attributes)) {
      element.setAttribute(key, value);
    }
    return element;
  };

  test('reads all attributes except excluded ones', () => {
    const element = createElement({
      id: '123',
      label: 'test',
      placeholders: '1',
      customData: 'value1',
      anotherField: 'value2'
    });

    const metadata = _test.readMetadata(element);

    expect(metadata).toEqual({
      customData: 'value1',
      anotherField: 'value2'
    });
  });

  test('excludes id attribute', () => {
    const element = createElement({
      id: '123',
      data: 'value'
    });

    const metadata = _test.readMetadata(element);

    expect(metadata).not.toHaveProperty('id');
    expect(metadata).toEqual({ data: 'value' });
  });

  test('excludes label attribute', () => {
    const element = createElement({
      label: 'test label',
      data: 'value'
    });

    const metadata = _test.readMetadata(element);

    expect(metadata).not.toHaveProperty('label');
    expect(metadata).toEqual({ data: 'value' });
  });

  test('excludes placeholders attribute', () => {
    const element = createElement({
      placeholders: '1',
      data: 'value'
    });

    const metadata = _test.readMetadata(element);

    expect(metadata).not.toHaveProperty('placeholders');
    expect(metadata).toEqual({ data: 'value' });
  });

  test('returns empty object when no attributes present', () => {
    const element = createElement({});

    const metadata = _test.readMetadata(element);

    expect(metadata).toEqual({});
  });

  test('returns empty object when only excluded attributes present', () => {
    const element = createElement({
      id: '123',
      label: 'test',
      placeholders: '1'
    });

    const metadata = _test.readMetadata(element);

    expect(metadata).toEqual({});
  });

  test('handles multiple custom attributes', () => {
    const element = createElement({
      field1: 'value1',
      field2: 'value2',
      field3: 'value3',
      field4: 'value4'
    });

    const metadata = _test.readMetadata(element);

    expect(metadata).toEqual({
      field1: 'value1',
      field2: 'value2',
      field3: 'value3',
      field4: 'value4'
    });
  });

  test('handles attributes with special characters', () => {
    const element = createElement({
      'data-custom': 'value',
      'x-attribute': 'test'
    });

    const metadata = _test.readMetadata(element);

    expect(metadata).toEqual({
      'data-custom': 'value',
      'x-attribute': 'test'
    });
  });

  test('handles empty string values', () => {
    const element = createElement({
      emptyAttr: '',
      normalAttr: 'value'
    });

    const metadata = _test.readMetadata(element);

    expect(metadata).toEqual({
      normalAttr: 'value'
    });
  });
});
