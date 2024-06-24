// TODO: Need to properly test this
export const stripTags = (
  input: string,
  allowed: Array<string> = ['br', 'i', 'u', 'b', 'span', 'div']
) => {
  const tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  const comments = /<!--[\s\S]*?-->/gi;
  return input
    .replace(comments, '')
    .replace(tags, ($0, $1) => (allowed.includes($1.toLowerCase()) ? $0 : ''));
};
