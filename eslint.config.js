import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/.next/**', '.data/**', 'test-results/**', 'apps/web/public/**', 'apps/web/next-env.d.ts'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-console': 'off',
      // Guard the architecture: geography must never import presentation.
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['packages/geo/**/*.ts', 'packages/core/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [{ group: ['@maploom/render', '@maploom/render/*', '@maploom/server', '@maploom/server/*'], message: 'Geography/core must not depend on rendering or server code.' }] }] },
  },
  {
    files: ['packages/render/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [{ group: ['@maploom/server', '@maploom/server/*'], message: 'The renderer must stay pure (no server code).' }] }] },
  },
);
