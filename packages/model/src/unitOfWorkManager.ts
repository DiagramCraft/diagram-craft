import {
  UOWTrackable,
  UOWTrackableParentChildSpecification,
  UOWTrackableSpecification
} from '@diagram-craft/model/unitOfWork';
import { mustExist } from '@diagram-craft/utils/assert';

export class UnitOfWorkManager {
  // biome-ignore lint/suspicious/noExplicitAny: Need any in this case
  static trackableSpecs: Record<
    UOWTrackable['_trackableType'],
    UOWTrackableSpecification<any, any>
  > = {};
  // biome-ignore lint/suspicious/noExplicitAny: Need any in this case
  static parentChildSpecs: Record<string, UOWTrackableParentChildSpecification<any>> = {};

  // biome-ignore lint/suspicious/noExplicitAny: Need any in this case
  static getSpec(
    trackableType: UOWTrackable['_trackableType']
  ): UOWTrackableSpecification<any, any> {
    return mustExist(UnitOfWorkManager.trackableSpecs[trackableType]);
  }

  // biome-ignore lint/suspicious/noExplicitAny: Need any in this case
  static getParentChildSpec(trackableType: string): UOWTrackableParentChildSpecification<any> {
    return mustExist(UnitOfWorkManager.parentChildSpecs[trackableType]);
  }
}
