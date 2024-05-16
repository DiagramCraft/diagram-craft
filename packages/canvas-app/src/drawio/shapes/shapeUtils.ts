import { Stencil } from '@diagram-craft/model/elementDefinitionRegistry';

export const findStencilByName = (stencils: Array<Stencil>, name: string) => {
  const s = stencils.find(s => s.key?.toLowerCase() === name.toLowerCase());
  if (!s) {
    throw new Error(`Cannot find stencil ${name}`);
  }
  return s;
};

export const stencilNameToType = (n: string) => {
  return n.toLowerCase().replaceAll(' ', '_').replaceAll('-', '_').replaceAll("'", '');
};
