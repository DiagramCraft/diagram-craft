import { Diagram } from './diagram.ts';

export class DiagramDocument<T extends Diagram> {
  constructor(public readonly diagrams: T[]) {}
}
