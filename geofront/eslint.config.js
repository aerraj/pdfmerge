import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { oneComponentPerFile } from './tools/eslint/one-component-per-file.js';

export default tseslint.config(
  {
    ignores: ['.scratch', 'dist', 'bench', 'coverage', 'playwright-report', 'test-results', 'public', 'assets-review', 'node_modules'],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: { allowDefaultProject: ['eslint.config.js', 'tools/eslint/*.js'] }, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh, geofront: { rules: { 'one-component-per-file': oneComponentPerFile } } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
      'geofront/one-component-per-file': 'error',
      // AGENTS.md rule 4: tunable numbers live in src/config/, never inline.
      '@typescript-eslint/no-magic-numbers': [
        'error',
        {
          ignore: [-1, 0, 0.5, 1, 2, 3, 4],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: false,
          ignoreEnums: true,
          ignoreNumericLiteralTypes: true,
          ignoreReadonlyClassProperties: false,
          ignoreTypeIndexes: true,
        },
      ],
    },
  },
  {
    // Config holds the numbers; dev tooling and test scenes never ship.
    files: ['src/config/**/*.ts', 'src/dev/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-magic-numbers': 'off' },
  },
  {
    files: ['scripts/**/*.ts', 'tests/**/*.{ts,tsx}', '*.config.ts', 'tools/**/*.js', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['eslint.config.js', 'tools/**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
