import { execSync } from 'node:child_process';
import { writeJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { applicationGenerator } from '../application/application';
import { integrationGenerator } from './integration';

vi.mock('node:child_process', () => ({ execSync: vi.fn() }));

vi.mock('@nx/devkit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@nx/devkit')>()),
  getPackageManagerCommand: () => ({ exec: 'npx' }),
}));

describe('integrationGenerator', () => {
  let tree: Tree;

  beforeEach(() => {
    vi.clearAllMocks();
    tree = createTreeWithEmptyWorkspace();
    writeJson(tree, 'package.json', { name: 'source', workspaces: ['apps/*'] });
    writeJson(tree, 'apps/site/package.json', { name: '@acme/site' });
  });

  it('runs astro add with the integrations in the folder of the project', async () => {
    tree.write('apps/site/astro.config.ts', 'export default {};\n');

    const callback = await integrationGenerator(tree, {
      project: '@acme/site',
      integrations: ['vue', 'sitemap'],
    });
    await callback();

    expect(execSync).toHaveBeenCalledWith('npx astro add vue sitemap --yes', {
      cwd: `${tree.root}/apps/site`,
      stdio: 'inherit',
    });
  });

  it('finds an application that the application generator created in a workspace without workspaces', async () => {
    tree = createTreeWithEmptyWorkspace();
    await applicationGenerator(tree, {
      directory: 'apps/blog',
      skipFormat: true,
    });

    const callback = await integrationGenerator(tree, {
      project: 'blog',
      integrations: ['mdx'],
    });
    await callback();

    expect(execSync).toHaveBeenCalledWith('npx astro add mdx --yes', {
      cwd: `${tree.root}/apps/blog`,
      stdio: 'inherit',
    });
  });

  it('rejects a project without an Astro config file', async () => {
    await expect(
      integrationGenerator(tree, {
        project: '@acme/site',
        integrations: ['vue'],
      }),
    ).rejects.toThrow(
      '@acme/site has no astro.config file in apps/site. Pass an Astro project.',
    );
  });

  it.each([
    [[], 'Pass at least one integration, for example --integrations=react.'],
    [
      ['vue', '-y'],
      '"-y" is not a valid integration name. Pass names such as "react" or "@astrojs/mdx".',
    ],
  ])('rejects the integrations %o', async (integrations, message) => {
    tree.write('apps/site/astro.config.mjs', 'export default {};\n');

    await expect(
      integrationGenerator(tree, { project: '@acme/site', integrations }),
    ).rejects.toThrow(message);
  });
});
