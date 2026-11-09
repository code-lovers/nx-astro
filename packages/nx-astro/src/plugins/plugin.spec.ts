import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  logger,
  type CreateNodesContext,
  type NxJsonConfiguration,
} from '@nx/devkit';
import { ASTRO_CONFIG_GLOB, createNodes } from './plugin';

const [, createNodesFunction] = createNodes;

describe('createNodes', () => {
  let workspaceRoot: string;

  const writeFile = (path: string, content: string) => {
    const absolutePath = join(workspaceRoot, path);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
  };

  const contextWith = (
    namedInputs: NxJsonConfiguration['namedInputs'] = {
      default: [],
      production: [],
    },
  ) =>
    ({
      workspaceRoot,
      nxJsonConfiguration: { namedInputs },
    }) satisfies CreateNodesContext;

  const run = async (
    configFiles: string[],
    options = {},
    context = contextWith(),
  ) => createNodesFunction(configFiles, options, context);

  const projectsOf = async (...args: Parameters<typeof run>) =>
    Object.fromEntries(
      (await run(...args)).flatMap(([, result]) =>
        Object.entries(result.projects ?? {}),
      ),
    );

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'nx-astro-plugin-'));
  });

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('matches every config file name that Astro 7 resolves', () => {
    expect(ASTRO_CONFIG_GLOB).toBe(
      '**/{astro.config.mjs,astro.config.js,astro.config.ts,astro.config.mts}',
    );
  });

  it('creates a project with the inferred targets and the outDir of the config', async () => {
    writeFile('apps/site/package.json', '{}');
    writeFile(
      'apps/site/astro.config.mjs',
      "export default defineConfig({ outDir: './build' });",
    );

    const projects = await projectsOf(['apps/site/astro.config.mjs']);

    expect(Object.keys(projects)).toEqual(['apps/site']);
    expect(projects['apps/site']?.root).toBe('apps/site');
    expect(Object.keys(projects['apps/site']?.targets ?? {}).sort()).toEqual([
      'build',
      'dev',
      'preview',
      'sync',
    ]);
    expect(projects['apps/site']?.targets?.build?.outputs).toEqual([
      '{projectRoot}/build',
      '{projectRoot}/.astro',
    ]);
  });

  it('accepts a project.json instead of a package.json', async () => {
    writeFile('apps/site/project.json', '{}');
    writeFile('apps/site/astro.config.ts', 'export default {};');

    const projects = await projectsOf(['apps/site/astro.config.ts']);

    expect(Object.keys(projects)).toEqual(['apps/site']);
  });

  it('skips a config file without a package.json or project.json next to it', async () => {
    writeFile('apps/site/astro.config.mjs', 'export default {};');

    expect(await run(['apps/site/astro.config.mjs'])).toEqual([]);
  });

  it('uses only the config file that Astro 7 picks when a folder has two', async () => {
    writeFile('apps/site/package.json', '{}');
    writeFile('apps/site/astro.config.ts', "export default { outDir: 'ts' };");
    writeFile(
      'apps/site/astro.config.mjs',
      "export default { outDir: 'mjs' };",
    );

    const results = await run([
      'apps/site/astro.config.ts',
      'apps/site/astro.config.mjs',
    ]);

    expect(results.map(([file]) => file)).toEqual([
      'apps/site/astro.config.mjs',
    ]);
    expect(
      results[0]?.[1].projects?.['apps/site']?.targets?.build?.outputs,
    ).toContain('{projectRoot}/mjs');
  });

  it('keeps one project per folder when folders use different config files', async () => {
    writeFile('apps/a/package.json', '{}');
    writeFile('apps/a/astro.config.ts', 'export default {};');
    writeFile('apps/b/package.json', '{}');
    writeFile('apps/b/astro.config.mjs', 'export default {};');

    const projects = await projectsOf([
      'apps/a/astro.config.ts',
      'apps/b/astro.config.mjs',
    ]);

    expect(Object.keys(projects).sort()).toEqual(['apps/a', 'apps/b']);
  });

  it('infers check when @astrojs/check resolves from the project', async () => {
    writeFile('apps/site/package.json', '{}');
    writeFile('apps/site/astro.config.mjs', 'export default {};');
    writeFile(
      'node_modules/@astrojs/check/package.json',
      '{ "name": "@astrojs/check", "main": "index.js" }',
    );
    writeFile('node_modules/@astrojs/check/index.js', '');

    const projects = await projectsOf(['apps/site/astro.config.mjs']);

    expect(projects['apps/site']?.targets).toHaveProperty('check');
  });

  it('applies the path overrides and target names from the options', async () => {
    writeFile('apps/site/package.json', '{}');
    writeFile(
      'apps/site/astro.config.mjs',
      "export default { outDir: 'build' };",
    );

    const projects = await projectsOf(['apps/site/astro.config.mjs'], {
      root: 'site',
      outDir: 'www',
      buildTargetName: 'astro-build',
      devTargetName: 'serve',
    });
    const targets = projects['apps/site']?.targets ?? {};

    expect(Object.keys(targets).sort()).toEqual([
      'astro-build',
      'preview',
      'serve',
      'sync',
    ]);
    expect(targets['astro-build']?.outputs).toContain('{projectRoot}/site/www');
  });

  it('uses the named inputs of nx.json', async () => {
    writeFile('apps/site/package.json', '{}');
    writeFile('apps/site/astro.config.mjs', 'export default {};');

    const projects = await projectsOf(
      ['apps/site/astro.config.mjs'],
      {},
      contextWith({ default: [] }),
    );

    expect(projects['apps/site']?.targets?.build?.inputs).toEqual([
      'default',
      '^default',
      { externalDependencies: ['astro'] },
    ]);
  });

  it('logs a verbose message for each key that is not a literal', async () => {
    const verbose = vi
      .spyOn(logger, 'verbose')
      .mockImplementation(() => undefined);
    writeFile('apps/site/package.json', '{}');
    writeFile(
      'apps/site/astro.config.mjs',
      'export default { outDir: process.env.OUT };',
    );

    await run(['apps/site/astro.config.mjs']);

    expect(verbose).toHaveBeenCalledTimes(1);
    expect(verbose).toHaveBeenCalledWith(
      expect.stringContaining('apps/site/astro.config.mjs: outDir'),
    );
  });

  it('logs a verbose message when the config does not parse', async () => {
    const verbose = vi
      .spyOn(logger, 'verbose')
      .mockImplementation(() => undefined);
    writeFile('apps/site/package.json', '{}');
    writeFile('apps/site/astro.config.mjs', 'export default {');

    const projects = await projectsOf(['apps/site/astro.config.mjs']);

    expect(Object.keys(projects)).toEqual(['apps/site']);
    expect(verbose).toHaveBeenCalledWith(
      expect.stringContaining('apps/site/astro.config.mjs does not parse'),
    );
  });

  it('logs nothing for a config with literal values', async () => {
    const verbose = vi
      .spyOn(logger, 'verbose')
      .mockImplementation(() => undefined);
    writeFile('apps/site/package.json', '{}');
    writeFile('apps/site/astro.config.mjs', "export default { outDir: 'x' };");

    await run(['apps/site/astro.config.mjs']);

    expect(verbose).not.toHaveBeenCalled();
  });
});
