export const INTEGRATION_SOURCE = 'github-releases';

export type Config = {
  host: string;
  port: number;
  archRegisterUrl: string;
  workspace: string;
  archRegisterToken: string;
  webhookSecret: string;
  sourceFieldId: string;
  targetFieldId: string;
  githubToken?: string;
};

const required = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
};

export const readConfig = (env: NodeJS.ProcessEnv = process.env): Config => {
  const port = Number(env['PORT'] ?? 3060);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return {
    host: env['HOST']?.trim() || '127.0.0.1',
    port,
    archRegisterUrl: required(env, 'ARCH_REGISTER_URL').replace(/\/$/, ''),
    workspace: required(env, 'ARCH_REGISTER_WORKSPACE'),
    archRegisterToken: required(env, 'ARCH_REGISTER_TOKEN'),
    webhookSecret: required(env, 'ARCH_REGISTER_WEBHOOK_SECRET'),
    sourceFieldId: required(env, 'SOURCE_FIELD_ID'),
    targetFieldId: required(env, 'TARGET_FIELD_ID'),
    githubToken: env['GITHUB_TOKEN']?.trim() || undefined
  };
};
