import { CRDTMap, CRDTRoot } from './collaboration/crdt';

const DEFAULT_COLOR = '#000000';

export class DiagramPalette {
  private palette: CRDTMap<string>;
  constructor(
    private readonly doc: CRDTRoot,
    count: number
  ) {
    this.palette = doc.getMap('customPalette');

    if (this.palette.size === 0 && count > 0) {
      this.doc.transact(() => {
        for (let i = 0; i < count; i++) {
          this.setColor(i, DEFAULT_COLOR);
        }
      });
    }
  }

  get colors() {
    const dest: string[] = [];
    for (let i = 0; i < 14; i++) {
      dest.push(this.palette.get(i.toString()) ?? DEFAULT_COLOR);
    }
    return dest;
  }

  setColor(idx: number, color: string) {
    this.palette.set(idx.toString(), color);
  }

  setColors(color: readonly string[]) {
    if (color.length === 0) return;
    this.doc.transact(() => {
      for (let i = 0; i < color.length; i++) {
        this.setColor(i, color[i]);
      }
    });
  }
}
