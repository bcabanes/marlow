import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc', '**/vitest.config.*.timestamp*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            // Scope boundary: marlow projects may only depend on marlow projects.
            {
              sourceTag: 'scope:marlow',
              onlyDependOnLibsWithTags: ['scope:marlow'],
            },
            // Layered (hexagonal) architecture: dependencies point inward.
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: [
                'type:domain',
                'type:application',
                'type:infrastructure',
                'type:contracts',
                'type:util',
              ],
            },
            {
              sourceTag: 'type:infrastructure',
              onlyDependOnLibsWithTags: [
                'type:application',
                'type:domain',
                'type:contracts',
                'type:util',
              ],
            },
            {
              sourceTag: 'type:application',
              onlyDependOnLibsWithTags: [
                'type:domain',
                'type:contracts',
                'type:util',
              ],
            },
            {
              sourceTag: 'type:domain',
              onlyDependOnLibsWithTags: ['type:util'],
            },
            {
              sourceTag: 'type:contracts',
              onlyDependOnLibsWithTags: ['type:util'],
            },
            {
              sourceTag: 'type:util',
              onlyDependOnLibsWithTags: ['type:util'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
