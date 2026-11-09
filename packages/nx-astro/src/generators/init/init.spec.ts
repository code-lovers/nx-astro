import { readJson, readNxJson, updateNxJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { astroVersion } from '../../utils/versions';
import { initGenerator } from './init';

const PLUGIN = '@code-lovers/nx-astro/plugin';

describe('initGenerator', () => {
  let tree: Tree;

  const pluginsOf = () => readNxJson(tree)?.plugins;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('registers the plugin in nx.json', async () => {
    await initGenerator(tree, { skipFormat: true });

    expect(pluginsOf()).toEqual([PLUGIN]);
  });

  it('keeps the other plugins and registers the plugin once', async () => {
    updateNxJson(tree, { ...readNxJson(tree), plugins: ['@nx/js/typescript'] });

    await initGenerator(tree, { skipFormat: true });
    await initGenerator(tree, { skipFormat: true });

    expect(pluginsOf()).toEqual(['@nx/js/typescript', PLUGIN]);
  });

  it('keeps a registration with options', async () => {
    const registration = {
      plugin: PLUGIN,
      options: { buildTargetName: 'astro-build' },
    };
    updateNxJson(tree, { ...readNxJson(tree), plugins: [registration] });

    await initGenerator(tree, { skipFormat: true });

    expect(pluginsOf()).toEqual([registration]);
  });

  it('adds astro to the root devDependencies and returns the install task', async () => {
    const install = await initGenerator(tree, { skipFormat: true });

    expect(readJson(tree, 'package.json').devDependencies).toEqual(
      expect.objectContaining({ astro: astroVersion }),
    );
    expect(install).toEqual(expect.any(Function));
  });

  it('keeps the astro version that the workspace already has', async () => {
    tree.write(
      'package.json',
      JSON.stringify({ name: 'repo', devDependencies: { astro: '7.1.0' } }),
    );

    await initGenerator(tree, { skipFormat: true });

    expect(readJson(tree, 'package.json').devDependencies.astro).toBe('7.1.0');
  });
});
