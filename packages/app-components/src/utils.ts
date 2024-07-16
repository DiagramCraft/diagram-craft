export const extractDataAttributes = (props: Record<string, unknown>) =>
  Object.keys(props).reduce((acc, key) => {
    if (key.startsWith('data-')) {
      // @ts-ignore
      acc[key] = props[key];
    }

    return acc;
  }, {});
