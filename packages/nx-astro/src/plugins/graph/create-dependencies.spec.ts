import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  DependencyType,
  logger,
  type CreateDependenciesContext,
  type FileData,
} from '@nx/devkit';
import { createDependencies } from './create-dependencies';

const PAGE = 'apps/site/src/pages/index.astro';
const SCRIPT = 'apps/site/src/lib/client.ts';

const PROJECTS = {
  site: { root: 'apps/site' },
  ui: { root: 'libs/ui' },
  data: { root: 'libs/data' },
};

describe('createDependencies', () => {
  let workspaceRoot: string;

  const writeFile = (path: string, content: string) => {
    const absolutePath = join(workspaceRoot, path);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
  };

  const linkInstalledAstro = () => {
    mkdirSync(join(workspaceRoot, 'node_modules'));
    symlinkSync(
      dirname(require.resolve('astro/package.json')),
      join(workspaceRoot, 'node_modules/astro'),
    );
  };

  const writeWorkspace = (page: string) => {
    writeFile('apps/site/package.json', '{ "name": "@acme/site" }');
    writeFile('libs/ui/package.json', '{ "name": "@acme/ui" }');
    writeFile(
      'tsconfig.base.json',
      [
        '{',
        '  // Nx reads tsconfig files with comments.',
        '  "compilerOptions": {',
        '    "paths": { "@acme/data": ["libs/data/src/index.ts"] }',
        '  }',
        '}',
      ].join('\n'),
    );
    writeFile('tsconfig.json', '{ "references": [] }');
    writeFile(PAGE, page);
    writeFile(SCRIPT, "import '@acme/ui';\n");
  };

  const fileData = (file: string): FileData => ({ file, hash: '' });

  const run = (files: readonly string[] = [PAGE, SCRIPT]) =>
    createDependencies({}, {
      workspaceRoot,
      projects: PROJECTS,
      externalNodes: {},
      nxJsonConfiguration: {},
      fileMap: { projectFileMap: {}, nonProjectFiles: [] },
      filesToProcess: {
        projectFileMap: { site: files.map(fileData) },
        nonProjectFiles: [],
      },
    } satisfies CreateDependenciesContext);

  const silence = (method: 'verbose' | 'warn') =>
    vi.spyOn(logger, method).mockImplementation(() => undefined);

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'nx-astro-graph-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('adds edges for the package names and tsconfig paths that .astro files import', async () => {
    linkInstalledAstro();
    writeWorkspace(
      "---\nimport Button from '@acme/ui/Button.astro';\nimport { load } from '@acme/data';\n---\n<Button />\n",
    );

    expect(await run()).toEqual([
      {
        source: 'site',
        target: 'ui',
        sourceFile: PAGE,
        type: DependencyType.static,
      },
      {
        source: 'site',
        target: 'data',
        sourceFile: PAGE,
        type: DependencyType.static,
      },
    ]);
  });

  it('reads the tsconfig paths of tsconfig.json when the workspace has no tsconfig.base.json', async () => {
    linkInstalledAstro();
    writeFile(PAGE, "---\nimport '@acme/data';\n---\n");
    writeFile(
      'tsconfig.json',
      '{ "compilerOptions": { "paths": { "@acme/data": ["libs/data/src/index.ts"] } } }',
    );

    expect(await run([PAGE])).toEqual([
      expect.objectContaining({ target: 'data' }),
    ]);
  });

  it('ignores a tsconfig path whose targets are not strings', async () => {
    linkInstalledAstro();
    writeWorkspace("---\nimport '@acme/ui';\n---\n");
    writeFile(
      'tsconfig.base.json',
      '{ "compilerOptions": { "paths": { "@acme/ui": [42] } } }',
    );

    expect(await run([PAGE])).toEqual([
      expect.objectContaining({ target: 'ui' }),
    ]);
  });

  it('adds no edges and loads no parser when no .astro file changed', async () => {
    const verbose = silence('verbose');
    const warn = silence('warn');
    writeWorkspace('');

    expect(await run([SCRIPT])).toEqual([]);
    expect(verbose).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs a verbose message and adds no edges when astro is not installed', async () => {
    const verbose = silence('verbose');
    const warn = silence('warn');
    writeWorkspace("---\nimport '@acme/ui';\n---\n");

    expect(await run()).toEqual([]);
    expect(verbose).toHaveBeenCalledWith(
      expect.stringContaining('astro does not resolve from the workspace root'),
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns and adds no edges when the Astro compiler does not load', async () => {
    const warn = silence('warn');
    writeWorkspace("---\nimport '@acme/ui';\n---\n");
    writeFile(
      'node_modules/astro/package.json',
      '{ "name": "astro", "exports": { "./package.json": "./package.json" } }',
    );
    writeFile(
      'node_modules/astro/node_modules/@astrojs/compiler-rs/package.json',
      '{ "name": "@astrojs/compiler-rs", "main": "index.js" }',
    );
    writeFile(
      'node_modules/astro/node_modules/@astrojs/compiler-rs/index.js',
      "throw new Error('missing native binding');",
    );

    expect(await run()).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(
        /cannot load the Astro compiler.*missing native binding/,
      ),
    );
  });

  it('logs the syntax errors of a file and keeps its edges', async () => {
    const verbose = silence('verbose');
    linkInstalledAstro();
    writeWorkspace("---\nimport '@acme/ui';\n---\n<div><span></div>\n");

    expect(await run()).toHaveLength(1);
    expect(verbose).toHaveBeenCalledWith(
      expect.stringMatching(
        /^apps\/site\/src\/pages\/index\.astro has syntax errors.*Expected corresponding JSX closing tag/,
      ),
    );
  });
});
