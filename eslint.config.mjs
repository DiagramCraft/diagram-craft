import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

// TODO: Re-enable eslint-plugin-storybook once it supports eslint 9, see
//       https://github.com/storybookjs/eslint-plugin-storybook/issues/157
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  //...tseslint.configs.stylistic,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.mjs'],
          defaultProject: './tsconfig.json'
        },
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    ignores: [
      '**/dist',
      '**/eslintrc.cjs',
      '**/*.js',
      '**/.storybook',
      '**/.*',
      '**/playground',
      '**/*.test.ts',
      '**/*.stories.tsx',
      '**/vite.config.ts'
    ]
  },
  {
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/only-throw-error': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-duplicate-type-constituents': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-base-to-string': 'off',

      '@typescript-eslint/no-unnecessary-condition': 'warn',

      'no-unused-labels': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          caughtErrors: 'none'
        }
      ],

      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-empty-object-type': [
        'error',
        {
          allowInterfaces: 'always'
        }
      ]
    }
  }
);
