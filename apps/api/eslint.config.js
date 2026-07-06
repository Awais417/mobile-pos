// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = tseslint.config(
  // Ye files/folders check nahi karni
  {
    ignores: ['dist', 'node_modules', 'eslint.config.js'],
  },

  // Base JavaScript recommended rules
  eslint.configs.recommended,

  // TypeScript recommended rules
  ...tseslint.configs.recommended,

  // Prettier ko ESLint mein jodta hai (aakhir mein taake conflicts na hon)
  prettierRecommended,

  // Hamare custom rules
  {
    languageOptions: {
      parserOptions: {
        project: 'tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      'prettier/prettier': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);