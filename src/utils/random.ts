export class Random {
  #seed: number;

  constructor(seed: number) {
    this.#seed = seed % 2147483647;
    if (this.#seed <= 0) this.#seed += 2147483646;
  }

  next() {
    return (this.#seed = (this.#seed * 16807) % 2147483647);
  }

  nextFloat() {
    return (this.next() - 1) / 2147483646;
  }

  nextFloatInRange(min: number, max: number) {
    return min + this.nextFloat() * (max - min);
  }
}
