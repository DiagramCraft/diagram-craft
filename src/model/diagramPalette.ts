export class DiagramPalette {
  constructor(private readonly palette: string[]) {}

  get colors() {
    return this.palette;
  }

  setColor(idx: number, color: string) {
    this.palette[idx] = color;
  }
}
