export type AssignmentAction = 'approve' | 'acknowledge' | 'review' | 'remediate';
export type Decision = 'none' | 'approve' | 'reject' | 'request_changes';

export type Config = {
  host: string;
  port: number;
  archRegisterUrl: string;
  workspace: string;
  archRegisterToken: string;
  webhookSecret: string;
  targetCapability: string;
  assignmentAction: AssignmentAction;
  autoDecision: Decision;
  decisionReason: string;
};

const required = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
};

const enumValue = <T extends string>(
  env: NodeJS.ProcessEnv,
  name: string,
  values: readonly T[],
  fallback: T
): T => {
  const value = env[name]?.trim() ?? fallback;
  if (!values.includes(value as T)) {
    throw new Error(`${name} must be one of: ${values.join(', ')}`);
  }
  return value as T;
};

export const readConfig = (env: NodeJS.ProcessEnv = process.env): Config => {
  const port = Number(env['PORT'] ?? 3070);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const autoDecision = enumValue(
    env,
    'AUTO_DECISION',
    ['none', 'approve', 'reject', 'request_changes'] as const,
    'none'
  );

  return {
    host: env['HOST']?.trim() ?? '127.0.0.1',
    port,
    archRegisterUrl: required(env, 'ARCH_REGISTER_URL').replace(/\/$/, ''),
    workspace: required(env, 'ARCH_REGISTER_WORKSPACE'),
    archRegisterToken: required(env, 'ARCH_REGISTER_TOKEN'),
    webhookSecret: required(env, 'ARCH_REGISTER_WEBHOOK_SECRET'),
    targetCapability: env['GOVERNANCE_TARGET_CAPABILITY']?.trim() ?? 'ws.settings',
    assignmentAction: enumValue(
      env,
      'GOVERNANCE_ASSIGNMENT_ACTION',
      ['approve', 'acknowledge', 'review', 'remediate'] as const,
      'approve'
    ),
    autoDecision,
    decisionReason: env['DECISION_REASON']?.trim() ?? 'Reviewed by the external governance engine'
  };
};
