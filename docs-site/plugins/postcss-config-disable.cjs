'use strict';

// Prevents postcss-loader from using cosmiconfig to search for config files,
// which triggers thousands of open() syscalls (one per candidate filename per
// CSS file in the pnpm virtual store), causing ENFILE on macOS.
// Setting postcssOptions.config=false tells postcss-loader to use only the
// inline postcssOptions already provided by Docusaurus.
module.exports = function postcssConfigDisablePlugin() {
  return {
    name: 'webpack-fd-optimize',
    configureWebpack(config) {
      patchRules(config.module?.rules ?? []);
      return { resolve: { symlinks: false } };
    }
  };
};

function patchRules(rules) {
  for (const rule of rules) {
    if (!rule || typeof rule !== 'object') continue;
    if (Array.isArray(rule.use)) patchUseArray(rule.use);
    if (Array.isArray(rule.oneOf)) patchRules(rule.oneOf);
    if (Array.isArray(rule.rules)) patchRules(rule.rules);
  }
}

function patchUseArray(uses) {
  for (const use of uses) {
    if (!use || typeof use !== 'object') continue;
    if (typeof use.loader === 'string' && use.loader.includes('postcss-loader')) {
      use.options ??= {};
      use.options.postcssOptions ??= {};
      use.options.postcssOptions.config = false;
    }
  }
}
