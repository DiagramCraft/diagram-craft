export const isDevUserSwitcherEnabled = (): boolean =>
  process.env['NODE_ENV'] !== 'production' && process.env['DEV_USER_SWITCHER_ENABLED'] === 'true';
