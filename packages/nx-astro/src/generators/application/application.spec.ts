import { execSync } from 'node:child_process';
import {
  addProjectConfiguration,
  installPackagesTask,
  readJson,
  readNxJson,
  readProjectConfiguration,
  writeJson,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { astroVersion } from '../../utils/versions';
import { applicationGenerator } from './application';

vi.mock('node:child_process', () => ({ execSync: vi.fn() }));

vi.mock('@nx/devkit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nx/devkit')>()),
  installPackagesTask: vi.fn(),
  getPackageManagerCommand: () => ({ exec: 'pnpm exec' }),
}));

describe('applicationGenerator', () => {
  let tree: Tree;

  const generate = (
    options: Partial<Parameters<typeof applicationGenerator>[1]> = {},
  ) =>
    applicationGenerator(tree, {
      directory: 'apps/site',
      skipFormat: true,
      ...options,
    });

  beforeEach(() => {
    vi.clearAllMocks();
    tree = createTreeWithEmptyWorkspace();
  });

  it('writes an Astro project with a package.json named after the folder', async () => {
    await generate();

    expect(tree.read('apps/site/astro.config.mjs', 'utf-8')).toContain(
      'defineConfig',
    );
    expect(tree.read('apps/site/src/pages/index.astro', 'utf-8')).toContain(
      "const title = 'site';",
    );
    expect(readJson(tree, 'apps/site/tsconfig.json')).toEqual({
      extends: 'astro/tsconfigs/strict',
      include: ['.astro/types.d.ts', '**/*'],
      exclude: ['dist'],
      nx: { addTypecheckTarget: false },
    });
    expect(readJson(tree, 'apps/site/package.json')).toEqual({
      name: 'site',
      private: true,
      type: 'module',
      dependencies: { astro: astroVersion },
    });
  });

  it('turns off the tsc typecheck target, which cannot check .astro files', async () => {
    await generate();

    expect(readJson(tree, 'apps/site/tsconfig.json').nx).toEqual({
      addTypecheckTarget: false,
    });
  });

  it('writes a project.json with the trimmed tags when the workspace does not use workspaces', async () => {
    await generate({ name: '@acme/site', tags: 'scope:web, type:app' });

    expect(readProjectConfiguration(tree, '@acme/site')).toEqual(
      expect.objectContaining({
        root: 'apps/site',
        projectType: 'application',
        sourceRoot: 'apps/site/src',
        tags: ['scope:web', 'type:app'],
      }),
    );
    expect(readJson(tree, 'apps/site/package.json').nx).toBeUndefined();
  });

  it('puts the tags in package.json and writes no project.json when the workspace uses workspaces', async () => {
    writeJson(tree, 'package.json', { name: 'source', workspaces: ['apps/*'] });

    await generate({ tags: 'scope:web' });

    expect(readJson(tree, 'apps/site/package.json').nx).toEqual({
      tags: ['scope:web'],
    });
    expect(tree.exists('apps/site/project.json')).toBe(false);
  });

  it('registers the plugin in nx.json', async () => {
    await generate();

    expect(readNxJson(tree)?.plugins).toEqual(['@code-lovers/nx-astro/plugin']);
  });

  it('adds the project folder to the workspaces of the package manager', async () => {
    writeJson(tree, 'package.json', { name: 'source', workspaces: [] });

    await generate();

    expect(readJson(tree, 'package.json').workspaces).toEqual(['apps/*']);
  });

  it('installs packages and adds no integration when none is selected', async () => {
    const callback = await generate();
    await callback();

    expect(installPackagesTask).toHaveBeenCalledWith(tree, true);
    expect(execSync).not.toHaveBeenCalled();
  });

  it('runs astro add in the project folder after the install', async () => {
    const callback = await generate({
      integrations: ['react', '@astrojs/mdx'],
    });
    await callback();

    expect(execSync).toHaveBeenCalledWith(
      'pnpm exec astro add react @astrojs/mdx --yes',
      { cwd: `${tree.root}/apps/site`, stdio: 'inherit' },
    );
    expect(
      vi.mocked(installPackagesTask).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(execSync).mock.invocationCallOrder[0] ?? 0);
  });

  it.each([
    [
      { name: 'Site' },
      '"Site" is not a valid package name. Pass a --name such as "site" or "@acme/site".',
    ],
    [
      { directory: 'apps/../../site' },
      'apps/../../site is outside the workspace. Pass a directory relative to the workspace root.',
    ],
    [
      { directory: '..' },
      '.. is outside the workspace. Pass a directory relative to the workspace root.',
    ],
    [
      { directory: '/srv/site' },
      '/srv/site is outside the workspace. Pass a directory relative to the workspace root.',
    ],
    [
      { name: '_site' },
      '"_site" is not a valid package name. Pass a --name such as "site" or "@acme/site".',
    ],
    [
      { name: '~site' },
      '"~site" is not a valid package name. Pass a --name such as "site" or "@acme/site".',
    ],
    [
      { integrations: ['~root'] },
      '"~root" is not a valid integration name. Pass names such as "react" or "@astrojs/mdx".',
    ],
    [
      { integrations: ['@~acme/ui'] },
      '"@~acme/ui" is not a valid integration name. Pass names such as "react" or "@astrojs/mdx".',
    ],
    [
      { integrations: ['--help'] },
      '"--help" is not a valid integration name. Pass names such as "react" or "@astrojs/mdx".',
    ],
    [
      { integrations: ['react; rm -rf ~'] },
      '"react; rm -rf ~" is not a valid integration name. Pass names such as "react" or "@astrojs/mdx".',
    ],
  ])('rejects %o before it writes any file', async (options, message) => {
    const changesBefore = tree.listChanges();

    await expect(generate(options)).rejects.toThrow(message);

    expect(tree.listChanges()).toEqual(changesBefore);
  });

  it('rejects a folder that already has a package.json', async () => {
    writeJson(tree, 'apps/site/package.json', { name: 'old' });

    await expect(generate()).rejects.toThrow(
      'apps/site already has a package.json. Pass a directory without a project.',
    );
  });

  it.each([
    [
      'a project.json',
      (tree: Tree) =>
        addProjectConfiguration(tree, 'site', { root: 'apps/old' }),
    ],
    [
      'a package.json in the workspaces',
      (tree: Tree) => {
        writeJson(tree, 'package.json', {
          name: 'root',
          workspaces: ['apps/*'],
        });
        writeJson(tree, 'apps/old/package.json', { name: 'site' });
      },
    ],
  ])('rejects a name that %s project already uses', async (_kind, addSite) => {
    addSite(tree);
    const changesBefore = tree.listChanges();

    await expect(
      generate({ directory: 'apps/new', name: 'site' }),
    ).rejects.toThrow(
      '"site" is already the name of the project in apps/old. Pass another --name.',
    );

    expect(tree.listChanges()).toEqual(changesBefore);
  });
});
