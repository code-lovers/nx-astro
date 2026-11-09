import { readJson, writeJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addProjectToWorkspaces } from './add-project-to-workspaces';

describe('addProjectToWorkspaces', () => {
  let tree: Tree;

  const setWorkspaces = (workspaces: unknown) =>
    writeJson(tree, 'package.json', { name: '@acme/source', workspaces });

  const workspacesOf = () => readJson(tree, 'package.json').workspaces;

  const addPackage = (directory: string) =>
    writeJson(tree, `${directory}/package.json`, { name: directory });

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('changes nothing when the workspace does not use workspaces', () => {
    const before = tree.read('package.json', 'utf-8');

    addProjectToWorkspaces(tree, 'apps/site');

    expect(tree.read('package.json', 'utf-8')).toBe(before);
    expect(tree.exists('pnpm-workspace.yaml')).toBe(false);
  });

  it('adds a pattern for the parent folder when it matches no other package', () => {
    setWorkspaces(['packages/*']);
    addPackage('packages/ui');
    addPackage('apps/site');
    tree.write('apps/docs/README.md', '');

    addProjectToWorkspaces(tree, 'apps/site');

    expect(readJson(tree, 'package.json')).toEqual({
      name: '@acme/source',
      workspaces: ['packages/*', 'apps/*'],
    });
  });

  it('adds the exact folder when the parent pattern also matches another package', () => {
    setWorkspaces(['packages/*']);
    addPackage('apps/legacy');

    addProjectToWorkspaces(tree, 'apps/site');

    expect(workspacesOf()).toEqual(['packages/*', 'apps/site']);
  });

  it('adds a pattern for the parent folder when the other packages there are already included', () => {
    setWorkspaces(['apps/legacy']);
    addPackage('apps/legacy');

    addProjectToWorkspaces(tree, 'apps/site');

    expect(workspacesOf()).toEqual(['apps/legacy', 'apps/*']);
  });

  it('adds the exact folder for a project in the workspace root folder', () => {
    setWorkspaces([]);

    addProjectToWorkspaces(tree, 'site');

    expect(workspacesOf()).toEqual(['site']);
  });

  it('changes nothing when a pattern already includes the folder', () => {
    setWorkspaces(['apps/**']);

    addProjectToWorkspaces(tree, 'apps/web/site');

    expect(workspacesOf()).toEqual(['apps/**']);
  });

  it('does not count a negated pattern as one that includes the folder', () => {
    setWorkspaces(['!apps/legacy']);

    addProjectToWorkspaces(tree, 'apps/site');

    expect(workspacesOf()).toEqual(['!apps/legacy', 'apps/*']);
  });

  it('adds the pattern to the packages of a workspaces object', () => {
    setWorkspaces({ packages: ['packages/*'], nohoist: ['**/react'] });

    addProjectToWorkspaces(tree, 'apps/site');

    expect(readJson(tree, 'package.json')).toEqual({
      name: '@acme/source',
      workspaces: {
        packages: ['packages/*', 'apps/*'],
        nohoist: ['**/react'],
      },
    });
  });

  it('adds the pattern to pnpm-workspace.yaml and keeps its comments and other keys', () => {
    tree.write(
      'pnpm-workspace.yaml',
      [
        '# Projects of the monorepo',
        'packages:',
        "  - 'packages/*'",
        'catalog:',
        '  astro: ^7.4.7',
        '',
      ].join('\n'),
    );

    addProjectToWorkspaces(tree, 'apps/site');

    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toBe(
      [
        '# Projects of the monorepo',
        'packages:',
        "  - 'packages/*'",
        '  - apps/*',
        'catalog:',
        '  astro: ^7.4.7',
        '',
      ].join('\n'),
    );
    expect(workspacesOf()).toBeUndefined();
  });

  it('reads a numeric pattern of pnpm-workspace.yaml as a folder name', () => {
    tree.write('pnpm-workspace.yaml', 'packages:\n  - 2024\n');

    addProjectToWorkspaces(tree, '2024');

    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toBe(
      'packages:\n  - 2024\n',
    );
  });

  it('ignores a pnpm-workspace.yaml without packages, as pnpm does', () => {
    tree.write('pnpm-workspace.yaml', 'catalog:\n  astro: ^7.4.7\n');

    addProjectToWorkspaces(tree, 'apps/site');

    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toBe(
      'catalog:\n  astro: ^7.4.7\n',
    );
  });
});
