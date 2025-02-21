import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { VerifyNotReached } from '@diagram-craft/utils/assert';
import { unique } from '@diagram-craft/utils/array';

const MAX_LENGTH = 30;

export const registerStencilUse = (id: string, d: DiagramDocument) => {
  let recentStencils = d.extra.recentStencils ?? [];
  if (!Array.isArray(recentStencils)) throw new VerifyNotReached();
  recentStencils.unshift(id);

  recentStencils = unique(recentStencils);

  d.extra.recentStencils =
    recentStencils.length > MAX_LENGTH ? recentStencils.slice(0, MAX_LENGTH) : recentStencils;
};

export const getRecentStencils = (d: DiagramDocument): string[] => {
  const recentStencils = d.extra.recentStencils ?? [];
  if (!Array.isArray(recentStencils)) throw new VerifyNotReached();
  return recentStencils as string[];
};
