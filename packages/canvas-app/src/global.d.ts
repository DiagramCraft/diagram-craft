declare module '*.yaml' {
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  const value: Record<string, any>;
  export default value;
}
