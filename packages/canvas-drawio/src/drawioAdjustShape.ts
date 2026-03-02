export const adjustShape = (shape: string) => {
  if (
    /^(module|folder|component|providedRequiredInterface|requiredInterface|uml[A-Z][a-z]+)$/.test(
      shape
    )
  ) {
    return `mxgraph.${shape}`;
  } else {
    return shape;
  }
};
