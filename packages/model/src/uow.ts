import { Diagram } from '@diagram-craft/model/diagram';
import { newid } from '@diagram-craft/utils/id';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { mustExist } from '@diagram-craft/utils/assert';
import { UndoableAction } from '@diagram-craft/model/undoManager';

type UOWInternal = {
  id: string;
  label: string;
  type: 'regular' | 'isolated';
  diagram?: Diagram;
  _uow: UnitOfWork;
  metadata: Record<string, unknown>;
};

const uowStack: UOWInternal[] = [];

export const UOW = {
  with: <T>(diagram: Diagram, s: string, op: () => T) => {
    const id = UOW.begin(diagram, s);
    try {
      return op();
    } finally {
      UOW.end(id);
    }
  },

  begin: (diagram: Diagram, s: string) => {
    const id = newid();
    uowStack.push({
      id,
      label: s,
      type: 'regular',
      diagram: diagram,
      _uow: new UnitOfWork(diagram, true, false),
      metadata: {}
    });
    return id;
  },

  end: (id?: string) => {
    const u = mustExist(uowStack.pop());
    if (id && u?.id !== id) throw new Error(`Invalid UOW ID: ${id}`);
    u._uow.commit();
  },

  abort: (id?: string) => {
    const u = mustExist(uowStack.pop());
    if (id && u?.id !== id) throw new Error(`Invalid UOW ID: ${id}`);
    u._uow.abort();
  },

  metadata: () => {
    return mustExist(uowStack.at(-1)).metadata;
  },

  onBeforeEnd: (cb: () => void, id?: string) => {
    const u = mustExist(uowStack.at(-1));
    u._uow.registerOnCommitCallback(id ?? newid(), undefined, cb);
  },

  onAfterEnd: (cb: () => void, id?: string) => {},

  onAbort: (cb: () => void, id?: string) => {},

  current: () => {
    const p = uowStack.at(-1);
    return p ? p.type : undefined;
  },

  notify: () => {
    mustExist(uowStack.at(-1))._uow.notify();
  },

  addOperation: (op: UndoableAction) => {},

  uow: () => {
    return mustExist(uowStack.at(-1))._uow;
  },

  Isolated: {
    with: <T>(diagram: Diagram, s: string, op: () => T) => {
      const id = UOW.Isolated.begin(diagram, s);
      try {
        return op();
      } finally {
        UOW.end(id);
      }
    },
    begin: (diagram: Diagram, s: string) => {
      const id = newid();
      uowStack.push({
        id,
        label: s,
        type: 'isolated',
        diagram: diagram,
        _uow: new UnitOfWork(diagram, true, false),
        metadata: {}
      });
      return id;
    }
  },

  Tracking: {}
};
