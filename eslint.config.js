import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      'vendor/**',
      'supabase/functions/**', // Deno runtime — different globals and module resolution
      '.brain/**',
    ],
  },

  // Web app: React + TypeScript, browser globals.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Generated shadcn/ui primitives lean on `any` in a few prop spreads.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // Repo tooling config files run under Node.
  {
    files: ['*.config.{js,ts}', 'apps/*/*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },

  prettier
);
