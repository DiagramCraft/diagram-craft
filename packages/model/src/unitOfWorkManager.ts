import {
  UOWTrackable,
  UOWChildAdapter,
  UOWAdapter,
  Snapshot
} from '@diagram-craft/model/unitOfWork';
import { mustExist } from '@diagram-craft/utils/assert';

export class UnitOfWorkManager {
  // biome-ignore lint/suspicious/noExplicitAny: Need any in this case
  static adapters: Record<UOWTrackable['_trackableType'], UOWAdapter<any, any>> = {};
  // biome-ignore lint/suspicious/noExplicitAny: Need any in this case
  static childAdapters: Record<string, UOWChildAdapter<any>> = {};

  static getAdapter(
    trackableType: UOWTrackable['_trackableType']
  ): UOWAdapter<Snapshot, UOWTrackable> {
    return mustExist(UnitOfWorkManager.adapters[trackableType]);
  }

  static getChildAdapter(parent: string, child: string): UOWChildAdapter<Snapshot> {
    return mustExist(UnitOfWorkManager.childAdapters[`${parent}-${child}`]);
  }
}
