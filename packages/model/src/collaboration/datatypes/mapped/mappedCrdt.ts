import { CRDTCompatibleObject, CRDTMap } from '../../crdt';

export type CRDTMapper<T, C extends Record<string, CRDTCompatibleObject>> = {
  fromCRDT: (e: CRDTMap<C>) => T;
  toCRDT: (e: T) => CRDTMap<C>;
};

// TODO: Do we need both of these? Can we simplify and only use SimpleCRDTMapper
export type SimpleCRDTMapper<T, C extends CRDTCompatibleObject> = {
  fromCRDT: (e: C) => T;
  toCRDT: (e: T) => C;
};
