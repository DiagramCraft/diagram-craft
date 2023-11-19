export const propsUtils = {
  except: <T>(props: T, ...keys: (keyof T)[]) => {
    const result = { ...props };
    for (const key of keys) {
      delete result[key];
    }
    return result;
  }
};
