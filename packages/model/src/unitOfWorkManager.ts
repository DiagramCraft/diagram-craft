import {
  Trackable,
  UOWTrackableParentChildSpecification,
  UOWTrackableSpecification
} from '@diagram-craft/model/unitOfWork';

export class UnitOfWorkManager {
  // @ts-expect-error
  // biome-ignore lint/suspicious/noExplicitAny: Need any in this case
  static trackableSpecs: Record<Trackable['trackableType'], UOWTrackableSpecification<any, any>> =
    {};
  // biome-ignore lint/suspicious/noExplicitAny: Need any in this case
  static parentChildSpecs: Record<string, UOWTrackableParentChildSpecification<any>> = {};
}
