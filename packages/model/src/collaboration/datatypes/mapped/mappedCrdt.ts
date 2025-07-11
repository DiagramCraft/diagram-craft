import { CRDTCompatibleObject, CRDTMap } from '../../crdt';

export type CRDTMapper<
  T,
  C extends Record<string, CRDTCompatibleObject> = Record<string, string>
> = {
  fromCRDT: (e: CRDTMap<C>) => T;
  toCRDT: (e: T) => CRDTMap<C>;
};
