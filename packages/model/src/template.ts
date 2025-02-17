import { FlatObject } from '@diagram-craft/utils/types';

export const applyTemplate = (
  text: string | undefined,
  props: FlatObject,
  applyLinebreaks = false
) => {
  text = text ?? '';
  text = applyLinebreaks ? applyLineBreaks(text) : text;
  for (const match of text.matchAll(/%(\w+)%/g)) {
    const key = match[1];
    const value = props[key];
    text = text.replace(match[0], value ? value.toString() : '');
  }
  return text;
};

export const applyLineBreaks = (s: string | undefined) => {
  return (s ?? '').replaceAll('\n', '<br>');
};
