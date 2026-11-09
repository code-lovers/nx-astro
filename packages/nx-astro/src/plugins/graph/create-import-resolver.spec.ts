import {
  createImportResolver,
  type ImportResolutionIndex,
} from './create-import-resolver';

const index: ImportResolutionIndex = {
  projectRoots: {
    site: 'apps/site',
    blog: 'apps/site/blog',
    ui: 'libs/ui',
    data: 'libs/data',
  },
  packageProjects: { '@acme/ui': 'ui', utils: 'data' },
  tsconfigPaths: {},
};

const resolverFor = (overrides: Partial<ImportResolutionIndex> = {}) =>
  createImportResolver({ ...index, ...overrides });

const FROM_PAGE = 'apps/site/src/pages/index.astro';

describe('createImportResolver', () => {
  const resolve = resolverFor();

  it('maps a relative import to the project that contains the target path', () => {
    expect(resolve(FROM_PAGE, '../../../../libs/ui/Button.astro')).toBe('ui');
  });

  it('maps a relative import inside the same project to that project', () => {
    expect(resolve(FROM_PAGE, '../layouts/Layout.astro')).toBe('site');
  });

  it('maps a relative import to the deepest project root that contains it', () => {
    expect(resolve(FROM_PAGE, '../../blog/post.astro')).toBe('blog');
  });

  it('maps a path outside every project to nothing', () => {
    expect(resolve(FROM_PAGE, '../../../../tools/script.ts')).toBeUndefined();
  });

  it('maps a path outside every other project to a project at the workspace root', () => {
    const withRootProject = resolverFor({
      projectRoots: { ...index.projectRoots, workspace: '.' },
    });

    expect(withRootProject(FROM_PAGE, '../../../../tools/script.ts')).toBe(
      'workspace',
    );
    expect(withRootProject(FROM_PAGE, '../layouts/Layout.astro')).toBe('site');
  });

  it('maps a relative import that leaves the workspace to nothing', () => {
    const withRootProject = resolverFor({
      projectRoots: { ...index.projectRoots, workspace: '.' },
    });

    expect(
      withRootProject(FROM_PAGE, '../../../../../outside/file.ts'),
    ).toBeUndefined();
    expect(withRootProject(FROM_PAGE, '../../../../..')).toBeUndefined();
  });

  it('does not match a project root that is only a prefix of the folder name', () => {
    expect(resolve(FROM_PAGE, '../../../../libs/ui-kit/Button.astro')).toBe(
      undefined,
    );
  });

  it('maps a package name and its subpaths to the project that publishes it', () => {
    expect(resolve(FROM_PAGE, '@acme/ui')).toBe('ui');
    expect(resolve(FROM_PAGE, '@acme/ui/Button.astro')).toBe('ui');
    expect(resolve(FROM_PAGE, 'utils')).toBe('data');
    expect(resolve(FROM_PAGE, 'utils/format')).toBe('data');
  });

  it('maps an exact and a wildcard tsconfig path to the project of its target', () => {
    const withPaths = resolverFor({
      tsconfigPaths: {
        '@acme/data': ['libs/data/src/index.ts'],
        '@acme/ui/*': ['./libs/ui/src/*'],
      },
    });

    expect(withPaths(FROM_PAGE, '@acme/data')).toBe('data');
    expect(withPaths(FROM_PAGE, '@acme/ui/Card.astro')).toBe('ui');
  });

  it('puts the text that the wildcard matched into the target path', () => {
    const withPaths = resolverFor({
      tsconfigPaths: {
        '@acme/*': ['libs/*/src/index.ts'],
        '#lib/*.js': ['libs/*/src/index.ts'],
      },
    });

    expect(withPaths(FROM_PAGE, '@acme/data')).toBe('data');
    expect(withPaths(FROM_PAGE, '#lib/data.js')).toBe('data');
  });

  it('does not match a wildcard path when the prefix and suffix overlap or the suffix differs', () => {
    const withPaths = resolverFor({
      packageProjects: {},
      tsconfigPaths: { '@acme/*/ui': ['libs/ui/src/index.ts'] },
    });

    expect(withPaths(FROM_PAGE, '@acme/ui')).toBeUndefined();
    expect(withPaths(FROM_PAGE, '@acme/web/data')).toBeUndefined();
    expect(withPaths(FROM_PAGE, '@acme/web/ui')).toBe('ui');
  });

  it('prefers a tsconfig path over a package name', () => {
    const withPaths = resolverFor({
      tsconfigPaths: { '@acme/ui': ['libs/data/src/index.ts'] },
    });

    expect(withPaths(FROM_PAGE, '@acme/ui')).toBe('data');
  });

  it('maps unknown packages and virtual modules to nothing', () => {
    expect(resolve(FROM_PAGE, 'react')).toBeUndefined();
    expect(resolve(FROM_PAGE, 'astro:content')).toBeUndefined();
    expect(resolve(FROM_PAGE, 'node:path')).toBeUndefined();
  });
});
