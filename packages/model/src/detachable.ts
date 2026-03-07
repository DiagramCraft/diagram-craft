import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

export interface Detachable<P> {
  _detach(root: boolean, callback: () => void, uow: UnitOfWork): void;
  _attach(root: boolean, parent: P, uow: UnitOfWork): void;
  _isAttached: boolean;
}
