export const applyTemplate = (text: string, props: Metadata) => {
  for (const match of text.matchAll(/%(\w+)%/g)) {
    const key = match[1];
    const value = props[key];
    text = text.replace(match[0], value?.toString() ?? '');
  }
  return text;
};
