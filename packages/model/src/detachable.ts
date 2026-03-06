import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

export interface Detachable<P> {
  _detach(root: boolean, uow: UnitOfWork, callback?: () => void): void;
  _attach(root: boolean, parent: P, uow: UnitOfWork): void;
  readonly _isAttached: boolean;
}
