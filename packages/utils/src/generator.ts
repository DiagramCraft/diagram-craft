export const Generators = {
  first: <T>(g: Generator<T>): T | undefined => {
    for (const e of g) return e;
    return undefined;
  }
};
