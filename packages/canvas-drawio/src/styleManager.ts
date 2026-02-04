import { parseNum } from '@diagram-craft/utils/number';

const STYLENAME_KEY = '_stylename';

type StringKey =
  | typeof STYLENAME_KEY
  | 'labelPosition'
  | 'verticalLabelPosition'
  | 'fontFamily'
  | 'align'
  | 'verticalAlign'
  | 'fontColor'
  | 'fillColor'
  | 'shape'
  | 'gradientColor'
  | 'gradientDirection'
  | 'strokeColor'
  | 'dashPattern'
  | 'labelBackgroundColor'
  | 'labelBorderColor'
  | 'endArrow'
  | 'edgeStyle'
  | 'childLayout'
  | 'image'
  | 'direction'
  | 'resIcon'
  | 'grStroke'
  | 'grIcon'
  | 'prIcon'
  | 'label'
  | 'imageHeight'
  | 'imageWidth'
  | 'imageBorder'
  | 'imageBackground'
  | 'imageAlign'
  | 'imageVerticalAlign'
  | 'participant'
  | 'overflow'
  | 'whiteSpace'
  | 'indicatorShape'
  | 'indicatorColor'
  | 'indicatorDirection'
  | 'portConstraint';

type BooleanKey =
  | 'rounded'
  | 'shadow'
  | 'flipH'
  | 'flipV'
  | 'sketch'
  | 'dashed'
  | 'curved'
  | 'top'
  | 'left'
  | 'right'
  | 'bottom'
  | 'imageAspect'
  | 'imageFlipV'
  | 'imageFlipH'
  | 'noLabel'
  | 'horizontal'
  | 'glass'
  | 'orthogonal'
  | 'rotatable'
  | 'editable'
  | 'resizable'
  | 'movable'
  | 'deletable'
  | 'absoluteArcSize';

type NumKey =
  | '_imageMargin'
  | 'textOpacity'
  | 'fontStyle'
  | 'arcSize'
  | 'exitX'
  | 'exitY'
  | 'exitDx'
  | 'exitDy'
  | 'entryX'
  | 'entryY'
  | 'entryDx'
  | 'entryDy'
  | 'fontSize'
  | 'spacingTop'
  | 'spacingBottom'
  | 'spacing'
  | 'spacingRight'
  | 'spacingLeft'
  | 'opacity'
  | 'strokeWidth'
  | 'rotation'
  | 'width'
  | 'endWidth'
  | 'endSize'
  | 'dx1'
  | 'dx2'
  | 'dy'
  | 'dx'
  | 'size'
  | 'startSize'
  | 'arcWidth'
  | 'endAngle'
  | 'startAngle'
  | 'notch'
  | 'jettyHeight'
  | 'jettyWidth'
  | 'indicatorWidth'
  | 'indicatorHeight'
  | 'perimeterSpacing'
  | 'sourcePerimeterSpacing'
  | 'targetPerimeterSpacing'
  | 'container';

type AllKeys = StringKey | BooleanKey | NumKey;

type Style = Partial<Record<AllKeys, string>>;

export class StyleManager {
  defaults: Partial<Record<string, Style>> & { default: Style } = {
    default: {
      _imageMargin: '0',
      imageWidth: '100%',
      imageHeight: '100%',
      imageAlign: 'left',
      imageVerticalAlign: 'middle',
      spacing: '2',
      spacingLeft: '0',
      spacingRight: '0',
      spacingTop: '0',
      spacingBottom: '0',
      align: 'center',
      verticalAlign: 'middle',
      overflow: 'visible',
      whiteSpace: 'noWrap'
    },
    image: {
      imageWidth: '100%',
      imageHeight: '100%',
      imageAlign: 'left',
      verticalAlign: 'top',
      verticalLabelPosition: 'bottom'
    },
    label: {
      _imageMargin: '7',
      imageWidth: '42',
      imageHeight: '42',
      imageAlign: 'left',
      spacingLeft: '52',
      fontSize: '12',
      fontStyle: '1',
      verticalAlign: 'middle'
    },
    icon: {
      spacing: '0',
      imageWidth: '48',
      imageHeight: '48',
      imageAlign: 'center',
      verticalLabelPosition: 'bottom',
      verticalAlign: 'top'
    },
    text: {
      spacingTop: '0',
      spacingBottom: '0',
      align: 'left',
      verticalAlign: 'top'
    },
    group: {
      verticalAlign: 'top'
    }
  };
  styleName: string;
  shape: string | undefined;
  styles: Style;

  private readonly styleKey: string;

  constructor(styleString: string, isGroup?: boolean) {
    this.styles = this.parseStyle(styleString);
    this.styleName = this.styles[STYLENAME_KEY] ?? 'default';
    this.styleKey = this.styles[STYLENAME_KEY] ?? (isGroup ? 'group' : 'default');

    this.shape = this.get('shape');
  }

  private parseStyle(style: string) {
    const parts = style.split(';');
    const result: Style = {};
    for (const part of parts) {
      const [key, ...value] = part.split('=');
      if (key === '') continue;

      result[key as AllKeys] = value.join('=');

      if (value.length === 0) {
        result[STYLENAME_KEY] = key;
      }
    }
    return result;
  }

  is(key: BooleanKey, def: boolean = false) {
    return !this.has(key) ? def : this.get(key) === '1';
  }

  str(key: StringKey): string | undefined;
  str(key: StringKey, def: string): string;
  str(key: StringKey, def?: string): string | undefined {
    return this.get(key) ?? def;
  }

  num(key: NumKey, def = 0) {
    return parseNum(this.get(key), def);
  }

  getOverride(key: AllKeys) {
    return this.styles[key];
  }

  get(key: string) {
    return (
      this.styles[key as AllKeys] ??
      this.defaults[this.styleKey]?.[key as AllKeys] ??
      this.defaults['default'][key as AllKeys]
    );
  }

  set(key: string, value: string) {
    this.styles[key as AllKeys] = value;
  }

  // TODO: This is a bad implementation
  has(key: AllKeys) {
    return /*this.get(key) !== undefined; // */ key in this.styles;
  }
}
