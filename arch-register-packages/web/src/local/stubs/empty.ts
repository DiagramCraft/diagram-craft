// Placeholder for Node-only modules that are present in the demo Worker's module graph but are
// never called (webhooks, collaboration, email, zip export, OIDC, filesystem storage).
const unavailable = (name: string) => () => {
  throw new Error(`${name} is not available in the browser demo`);
};

const stub = new Proxy(unavailable('module'), {
  get: (_t, prop) => (prop === 'then' ? undefined : unavailable(String(prop)))
});

export default stub;
