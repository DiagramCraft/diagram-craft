import { Diagram } from '@diagram-craft/model/diagram';
import { newid } from '@diagram-craft/utils/id';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { mustExist } from '@diagram-craft/utils/assert';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';

type UOWMetadata = Record<string, unknown>;
type UOWInternal = {
  id: string;
  label: string;
  type: 'reversible' | 'irreversible';
  diagram?: Diagram;
  _uow: UnitOfWork;
  metadata: UOWMetadata;
};

const uowStack: UOWInternal[] = [];

type UOWOpts = {
  label?: string;
  metadata?: UOWMetadata;
  _noSnapshot?: boolean;
};

export const UOW = {
  execute: <T>(diagram: Diagram, op: () => T) => {
    const id = UOW.begin(diagram);
    try {
      return op();
    } finally {
      UOW.end(id);
    }
  },

  _executeNoSnapshots: <T>(diagram: Diagram, op: () => T) => {
    const id = UOW.begin(diagram, { _noSnapshot: true });
    try {
      return op();
    } finally {
      UOW.end(id);
    }
  },

  executeWithUndo: <T>(diagram: Diagram, s: string, op: () => T) => {
    const id = UOW.begin(diagram, { label: s });
    try {
      return op();
    } finally {
      UOW.end(id);
    }
  },

  begin: (diagram: Diagram, opts?: UOWOpts) => {
    const current = uowStack.at(-1);
    if (current && current.type === 'reversible') throw new Error('Cannot nest reversible UOW');

    const id = newid();
    const type = opts?.label ? 'reversible' : 'irreversible';
    uowStack.push({
      id,
      label: opts?.label ?? '',
      type: type,
      diagram: diagram,
      _uow: new UnitOfWork(diagram, opts?._noSnapshot !== true, opts?._noSnapshot ?? false),
      metadata: opts?.metadata ?? {}
    });
    return id;
  },

  end: (id: string) => {
    const u = mustExist(uowStack.pop());
    if (u.id !== id) throw new Error(`Invalid UOW ID: ${id}`);

    if (!u._uow.trackChanges && u._uow.isThrowaway) {
      return;
    }

    if (u.type === 'reversible') {
      commitWithUndo(u._uow, u.label);
    } else {
      u._uow.commit();
    }
  },

  abort: (id: string) => {
    const u = mustExist(uowStack.pop());
    if (u.id !== id) throw new Error(`Invalid UOW ID: ${id}`);
    u._uow.abort();
  },
  /*
  metadata: () => {
    return mustExist(uowStack.at(-1)).metadata;
  },

  onBeforeEnd: (cb: () => void, id?: string) => {
    const u = mustExist(uowStack.at(-1));
    u._uow.registerOnCommitCallback(id ?? newid(), undefined, cb);
  },

  onAfterEnd: (cb: () => void, id?: string) => {},

  onAbort: (cb: () => void, id?: string) => {},
*/
  current: () => {
    return mustExist(uowStack.at(-1));
  },

  /*notify: () => {
    mustExist(uowStack.at(-1))._uow.notify();
  },*/

  //addOperation: (op: UndoableAction) => {},

  uow: () => {
    return mustExist(uowStack.at(-1))._uow;
  },

  Tracking: {}
};
