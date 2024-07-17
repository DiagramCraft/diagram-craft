export const extractDataAttributes = (
  props: Record<string, unknown>,
  include?: string[] | undefined
) =>
  Object.keys(props).reduce((acc, key) => {
    if (key.startsWith('data-') && (include === undefined || include.includes(key.substring(5)))) {
      // @ts-ignore
      acc[key] = props[key];
    }

    return acc;
  }, {});
