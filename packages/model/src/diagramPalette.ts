import { CRDTMap, CRDTRoot } from '@diagram-craft/collaboration/crdt';
import { assert } from '@diagram-craft/utils/assert';
import { NumericalString, numberToString } from '@diagram-craft/utils/number';

const DEFAULT_COLOR = '#000000';

type PaletteType = {
  [key: NumericalString]: string;
  count: number;
};

export class DiagramPalette {
  private readonly palette: CRDTMap<PaletteType>;

  constructor(
    private readonly doc: CRDTRoot,
    count: number
  ) {
    this.palette = doc.getMap<PaletteType>('customPalette');

    if (this.palette.size === 0 && count > 0) {
      this.doc.transact(() => {
        for (let i = 0; i < count; i++) {
          this.setColor(i, DEFAULT_COLOR);
        }
      });
    }
  }

  private get count() {
    return this.palette.get('count') ?? 0;
  }

  get colors() {
    const dest: string[] = [];
    for (let i = 0; i < this.count; i++) {
      dest.push((this.palette.get(numberToString(i)) as string) ?? DEFAULT_COLOR);
    }
    return dest;
  }

  setColor(idx: number, color: string) {
    assert.true(idx <= this.count);
    this.palette.set(numberToString(idx), color);
    this.palette.set('count', Math.max(this.count, idx + 1));
  }

  setColors(color: readonly string[]) {
    this.palette.clear();
    this.palette.set('count', color.length);

    if (color.length === 0) return;

    this.doc.transact(() => {
      for (let i = 0; i < color.length; i++) {
        this.setColor(i, color[i]!);
      }
    });
  }
}
