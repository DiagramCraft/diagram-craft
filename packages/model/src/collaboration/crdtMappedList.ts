import { CRDTList } from './crdt';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class CRDTMappedList<T = any, S = any> {
  #entries: T[] = [];

  constructor(
    private readonly list: CRDTList<S>,
    readonly factory: (e: S) => T,
    private readonly toCRDT: (e: T) => S
  ) {
    list.on('remoteDelete', e => {
      this.#entries.splice(e.index, e.count);
    });
    list.on('remoteInsert', e => {
      this.#entries.splice(e.index, 0, ...e.value.map(factory));
    });
  }

  get entries() {
    return this.#entries;
  }

  add(t: T) {
    this.#entries.push(t);
    this.list.push([this.toCRDT(t)]);
  }

  indexOf(t: T) {
    return this.#entries.indexOf(t);
  }

  remove(t: T) {
    const idx = this.#entries.indexOf(t);
    if (idx >= 0) {
      this.#entries.splice(idx, 1);
      this.list.delete(idx);
      return true;
    }
    return false;
  }

  toJSON() {
    return this.#entries;
  }
}
