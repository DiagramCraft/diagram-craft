export class Random {
  #state: number;

  constructor(seed: number) {
    this.#state = seed + 0x6d2b79f5;
  }

  // See https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
  private next() {
    let t = (this.#state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextFloat() {
    return this.next();
  }

  nextRange(min: number, max: number) {
    return min + this.nextFloat() * (max - min);
  }

  nextBoolean() {
    return this.next() > 0.5;
  }
}
