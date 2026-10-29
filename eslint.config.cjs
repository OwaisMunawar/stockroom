const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');
module.exports = defineConfig([
  expo,
  prettier,
  { ignores: ['ios/**', 'android/**', 'coverage/**', 'node_modules/**', 'server/data/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/server/**', 'node:*'],
              message: 'Server code and Node APIs cannot enter the mobile bundle.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['shared/**/*.ts', 'src/features/**/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-native',
                'expo',
                'expo-*',
                '**/data/**',
                '**/ui/**',
                '**/server/**',
                'node:*',
              ],
              message: 'Domain code must stay platform independent.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['server/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/src/**', 'react', 'react-native', 'expo-*'],
              message: 'The server shares contracts, never mobile adapters.',
            },
          ],
        },
      ],
    },
  },
]);
