export const Generators = {
  first: <T>(g: Generator<T>): T | undefined => {
    return g.next().value;
  }
};
