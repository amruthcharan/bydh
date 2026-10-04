import js from '@eslint/js';
import vue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'node_modules/', 'tools/**/.venv/', 'tools/**/runs/'] },
  js.configs.recommended,
  ...vue.configs['flat/essential'],
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
    },
  },
  // Builders keep the (group, item, material) signature even when they ignore an argument.
  { files: ['src/three/furniture/**'], rules: { 'no-unused-vars': ['error', { args: 'none' }] } },
  { files: ['*.config.js', 'tools/**/*.mjs'], languageOptions: { globals: { ...globals.node } } },
  prettier,
];
