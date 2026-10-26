export const relationLabel = (relation: { _in: { name: string }; _out: { name: string } }) =>
  `${relation._in.name} → ${relation._out.name}`;
