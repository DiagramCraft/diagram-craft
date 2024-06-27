export const parseSvgPath = (path: string) => {
  const commands = path.match(/[a-zA-Z][^a-zA-Z]*/g) ?? [];
  return commands.map(command => {
    return command.trim().split(/[\s,]+/);
  });
};
