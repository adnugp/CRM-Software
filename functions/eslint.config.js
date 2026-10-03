const parser = require('@typescript-eslint/parser');
const plugin = require('@typescript-eslint/eslint-plugin');
module.exports = [
  { ignores: ['src/dataconnect-admin-generated/**', 'lib/**'] },
  {
    files: ['src/**/*.ts'],
    languageOptions: { parser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
    plugins: { '@typescript-eslint': plugin },
    rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
];
