import { assert } from '@diagram-craft/utils/assert';

export type Style = Partial<Record<string, string>>;

export class StyleManager {
  defaults = {
    image: {
      _margin: 0,
      _textPosition: 'bottom',
      imageWidth: '100%',
      imageHeight: '100%',
      imageAlign: 'left',
      imageValign: 'middle'
    },
    default: {
      _margin: 0,
      _textPosition: 'bottom',
      imageWidth: '100%',
      imageHeight: '100%',
      imageAlign: 'left',
      imageValign: 'middle'
    },
    label: {
      _margin: 8,
      _textPosition: 'center',
      imageWidth: '42',
      imageHeight: '42',
      imageAlign: 'left',
      imageValign: 'middle'
    },
    icon: {
      _margin: 0,
      _textPosition: 'bottom',
      imageWidth: '48',
      imageHeight: '48',
      imageAlign: 'center',
      imageValign: 'middle'
    }
  };
  private stylename: string;

  constructor(private readonly styles: Style) {
    // TODO: More robust way to determine this
    const styleNames = Object.keys(styles).filter(a => a.startsWith('_') && a !== '_');
    assert.true(styleNames.length <= 1);
    this.stylename = styleNames[0]?.slice(1) ?? 'default';
  }

  get(key: string) {
    return (
      // @ts-ignore
      this.styles[key] ?? this.defaults[this.stylename]?.[key] ?? this.defaults['default'][key]
    );
  }

  set(key: string, value: string) {
    this.styles[key] = value;
  }

  has(key: string) {
    return key in this.styles;
  }
}
