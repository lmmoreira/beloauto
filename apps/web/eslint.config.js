const baseConfig = require('@beloauto/config/eslint-base');

module.exports = [...baseConfig, { ignores: ['next-env.d.ts'] }];
