import type { DiagramElement } from './diagramElement';

export class ElementLookup<T extends DiagramElement> {
  private _lookup = new Map<string, T>();

  get(id: string): T | undefined {
    return this._lookup.get(id);
  }

  set(id: string, element: T) {
    this._lookup.set(id, element);
  }

  delete(id: string) {
    this._lookup.delete(id);
  }

  has(id: string) {
    return this._lookup.has(id);
  }

  values() {
    return this._lookup.values();
  }

  keys() {
    return this._lookup.keys();
  }
}
