import { CRDTCompatibleObject } from '../../crdt';

export type CRDTMapper<T, C extends CRDTCompatibleObject> = {
  fromCRDT: (e: C) => T;
  toCRDT: (e: T) => C;
};
