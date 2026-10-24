// Flat ESLint config for every workspace package (each runs `eslint src [test]` from its own dir).
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/.next/**', '**/.turbo/**', '**/coverage/**', '**/*.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'off',
      // Money must stay integer paise; floats only through engine/money helpers.
      'no-restricted-globals': ['error', { name: 'parseFloat', message: 'Use parseRupees() from @ms/ui/format for money.' }],
    },
  },
  {
    files: ['apps/web/**/*.tsx', 'packages/ui/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  {
    // The engine is pure and deterministic: no wall clock, no Math.random, no I/O.
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: "MemberExpression[object.name='Math'][property.name='random']", message: 'Use seeded streams from rng.ts.' },
        { selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']", message: 'The engine uses the world clock, never wall time.' },
        { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: 'The engine uses the world clock, never wall time.' },
      ],
    },
  },
);
