import { useState } from 'react';
import type { GlobalRole } from '@arch-register/permissions';

const sameRoles = (left: GlobalRole[], right: GlobalRole[]) => {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((role, index) => role === sortedRight[index]);
};

export const useRoleDraft = (initial: GlobalRole[]) => {
  const [roles, setRoles] = useState<GlobalRole[]>(initial);

  const toggle = (role: GlobalRole) =>
    setRoles(current =>
      current.includes(role) ? current.filter(existing => existing !== role) : [...current, role]
    );

  return { roles, toggle, isDirty: !sameRoles(roles, initial) };
};
