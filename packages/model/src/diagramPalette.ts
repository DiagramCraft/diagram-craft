import { CRDTMap, CRDTProperty, CRDTRoot } from './collaboration/crdt';
import { assert } from '@diagram-craft/utils/assert';

const DEFAULT_COLOR = '#000000';

export class DiagramPalette {
  private readonly palette: CRDTMap<string>;

  private _count = new CRDTProperty<number>('count');

  constructor(
    private readonly doc: CRDTRoot,
    count: number
  ) {
    this.palette = doc.getMap('customPalette');
    this._count.set(this.palette, count);

    if (this.palette.size === 0 && count > 0) {
      this.doc.transact(() => {
        for (let i = 0; i < count; i++) {
          this.setColor(i, DEFAULT_COLOR);
        }
      });
    }
  }

  private get count() {
    return this._count.get(this.palette) ?? 0;
  }

  get colors() {
    const dest: string[] = [];
    for (let i = 0; i < this.count; i++) {
      dest.push(this.palette.get(i.toString()) ?? DEFAULT_COLOR);
    }
    return dest;
  }

  setColor(idx: number, color: string) {
    assert.true(idx <= this.count);
    this.palette.set(idx.toString(), color);
  }

  setColors(color: readonly string[]) {
    this.palette.clear();
    this._count.set(this.palette, color.length);

    if (color.length === 0) return;

    this.doc.transact(() => {
      for (let i = 0; i < color.length; i++) {
        this.setColor(i, color[i]);
      }
    });
  }
}
