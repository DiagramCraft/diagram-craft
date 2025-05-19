import { CRDTMap } from './collaboration/crdt';

const DEFAULT_COLOR = '#000000';

export class DiagramPalette {
  constructor(private readonly palette: CRDTMap<string>) {
    if (this.palette.size === 0) {
      for (let i = 0; i < 14; i++) {
        this.palette.set(i.toString(), DEFAULT_COLOR);
      }
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
}
