import {
  Trackable,
  UOWTrackableParentChildSpecification,
  UOWTrackableSpecification
} from '@diagram-craft/model/unitOfWork';

export class UnitOfWorkManager {
  // @ts-ignore
  static trackableSpecs: Record<Trackable['trackableType'], UOWTrackableSpecification<any, any>> =
    {};
  static parentChildSpecs: Record<string, UOWTrackableParentChildSpecification<any>> = {};
}
