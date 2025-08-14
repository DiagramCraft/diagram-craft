import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

// TODO: Re-enable eslint-plugin-storybook once it supports eslint 9, see
//       https://github.com/storybookjs/eslint-plugin-storybook/issues/157
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  //...tseslint.configs.stylistic,
  /*  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },*/
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
