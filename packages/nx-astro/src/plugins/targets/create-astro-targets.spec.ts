import {
  DEFAULT_TARGET_NAMES,
  createAstroTargets,
  type AstroTargetsInput,
} from './create-astro-targets';

const baseInput: AstroTargetsInput = {
  projectRoot: 'apps/site',
  facts: { root: '.', outDir: './dist' },
  targetNames: DEFAULT_TARGET_NAMES,
  hasAstroCheck: false,
  namedInputs: { default: [], production: [] },
};

const targetsFor = (input: Partial<AstroTargetsInput> = {}) =>
  createAstroTargets({ ...baseInput, ...input });

describe('createAstroTargets', () => {
  it('infers a cached build that runs astro build in the project root', () => {
    expect(targetsFor().build).toEqual({
      command: 'astro build',
      options: { cwd: 'apps/site' },
      cache: true,
      dependsOn: ['^build'],
      inputs: [
        'production',
        '^production',
        { externalDependencies: ['astro'] },
      ],
      outputs: ['{projectRoot}/dist', '{projectRoot}/.astro'],
      metadata: {
        technologies: ['astro'],
        description: 'Builds the Astro site.',
      },
    });
  });

  it('places the outputs under the root and outDir of the config', () => {
    const { build } = targetsFor({
      facts: { root: './site', outDir: './build' },
    });

    expect(build?.outputs).toEqual([
      '{projectRoot}/site/build',
      '{projectRoot}/site/.astro',
    ]);
  });

  it('uses a workspace path for an outDir outside the project root', () => {
    const { build } = targetsFor({
      facts: { root: '.', outDir: '../../dist/site' },
    });

    expect(build?.outputs).toEqual([
      '{workspaceRoot}/dist/site',
      '{projectRoot}/.astro',
    ]);
  });

  it('uses a workspace path for an outDir that is the parent folder', () => {
    const { build } = targetsFor({ facts: { root: '.', outDir: '..' } });

    expect(build?.outputs?.[0]).toBe('{workspaceRoot}/apps');
  });

  it('keeps project paths for a project at the workspace root', () => {
    const { build } = targetsFor({ projectRoot: '.' });

    expect(build?.options).toEqual({ cwd: '.' });
    expect(build?.outputs).toEqual([
      '{projectRoot}/dist',
      '{projectRoot}/.astro',
    ]);
  });

  it('falls back to the default inputs when the workspace has no production input', () => {
    const { build, sync, check } = targetsFor({
      namedInputs: { default: [] },
      hasAstroCheck: true,
    });

    expect(build?.inputs).toEqual([
      'default',
      '^default',
      { externalDependencies: ['astro'] },
    ]);
    expect(sync?.inputs).toEqual([
      'default',
      { externalDependencies: ['astro'] },
    ]);
    expect(check?.inputs).toEqual([
      'default',
      '^default',
      {
        externalDependencies: ['astro', '@astrojs/check', 'typescript'],
      },
    ]);
  });

  it('infers a cached sync that writes the generated types', () => {
    expect(targetsFor().sync).toEqual({
      command: 'astro sync',
      options: { cwd: 'apps/site' },
      cache: true,
      inputs: ['production', { externalDependencies: ['astro'] }],
      outputs: ['{projectRoot}/.astro'],
      metadata: {
        technologies: ['astro'],
        description: 'Generates the types of the Astro project.',
      },
    });
  });

  it('infers check only when @astrojs/check is installed', () => {
    expect(targetsFor()).not.toHaveProperty('check');
    expect(targetsFor({ hasAstroCheck: true }).check).toEqual({
      command: 'astro check',
      options: { cwd: 'apps/site' },
      cache: true,
      inputs: [
        'default',
        '^production',
        {
          externalDependencies: ['astro', '@astrojs/check', 'typescript'],
        },
      ],
      outputs: [],
      metadata: {
        technologies: ['astro'],
        description: 'Checks the Astro project for type and template errors.',
      },
    });
  });

  it('infers continuous dev and preview targets, and preview builds first', () => {
    const { dev, preview } = targetsFor();

    expect(dev).toEqual({
      command: 'astro dev',
      options: { cwd: 'apps/site' },
      continuous: true,
      metadata: {
        technologies: ['astro'],
        description: 'Starts the Astro dev server.',
      },
    });
    expect(preview).toEqual({
      command: 'astro preview',
      options: { cwd: 'apps/site' },
      continuous: true,
      dependsOn: ['build'],
      metadata: {
        technologies: ['astro'],
        description: 'Serves the built Astro site.',
      },
    });
  });

  it('uses the configured target names, also in dependsOn', () => {
    const targets = targetsFor({
      hasAstroCheck: true,
      targetNames: {
        build: 'astro-build',
        dev: 'serve',
        preview: 'serve-static',
        check: 'astro-check',
        sync: 'astro-sync',
      },
    });

    expect(Object.keys(targets).sort()).toEqual([
      'astro-build',
      'astro-check',
      'astro-sync',
      'serve',
      'serve-static',
    ]);
    expect(targets['astro-build']?.dependsOn).toEqual(['^astro-build']);
    expect(targets['serve-static']?.dependsOn).toEqual(['astro-build']);
  });
});

describe('DEFAULT_TARGET_NAMES', () => {
  it('names each target after its astro command', () => {
    expect(DEFAULT_TARGET_NAMES).toEqual({
      build: 'build',
      dev: 'dev',
      preview: 'preview',
      check: 'check',
      sync: 'sync',
    });
  });
});
