import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

/**
 * This interface is used to mark elements that can be detached from their parent and
 * the overall model. For instance, if you move a diagram element from one layer to another,
 * you can detach it from its current parent and attach it to a new one.
 */
export interface Detachable<P> {
  /**
   * Detaches this element from its current parent. Because the element must first copy
   * its underlying CRDT data before being removed, the actual removal from the parent
   * is deferred to the provided callback. The implementor is responsible for calling
   * the callback at the appropriate point during detachment.
   *
   * @param callback - The operation that removes this element from its parent. Called
   *   by the implementor after any necessary CRDT data has been copied.
   * @param uow - The unit of work used to record the change for undo/redo.
   */
  _detach(callback: () => void, uow: UnitOfWork): void;

  /**
   * Attaches this element to the given parent. Should only be called on a detached
   * element (i.e. after `_detach` has been called).
   *
   * @param parent - The new parent to attach to.
   * @param uow - The unit of work used to record the change for undo/redo.
   */
  _attach(parent: P, uow: UnitOfWork): void;

  /**
   * Whether this element is currently attached to a parent in the model.
   * An element starts detached and becomes attached once `_attach` is called.
   */
  _isAttached: boolean;
}
