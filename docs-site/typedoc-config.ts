const typedocEnv = process.env.DOCS_SITE_TYPEDOC;
const isDevServerCommand = process.argv.includes('start') || process.argv.includes('serve');

export const shouldGenerateTypedoc =
  typedocEnv === '1' || (typedocEnv == null && !isDevServerCommand);
