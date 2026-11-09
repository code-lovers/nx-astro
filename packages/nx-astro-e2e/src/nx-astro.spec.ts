import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { version as nxVersion } from 'nx/package.json';

const CACHE_HIT =
  'Nx read the output from the cache instead of running the command for 1 out of 1 tasks.';

// The e2e task runs inside Nx, which passes settings such as NX_SKIP_NX_CACHE
// to it. The test workspace is a separate Nx workspace, so it gets none of them.
const outerNxFreeEnv = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => !name.startsWith('NX_')),
);

describe('nx-astro', () => {
  let projectDirectory: string;

  const run = (command: string) =>
    execSync(command, {
      cwd: projectDirectory,
      encoding: 'utf-8',
      env: {
        ...outerNxFreeEnv,
        NX_DAEMON: 'false',
        NX_NO_CLOUD: 'true',
        // Every run publishes the same 0.0.0-e2e version, so a shared metadata
        // cache would install the tarball of an earlier run.
        pnpm_config_cache_dir: join(dirname(projectDirectory), 'pnpm-cache'),
      },
    });

  const writeFile = (path: string, content: string) => {
    const absolutePath = join(projectDirectory, path);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
  };

  // Each hook shells out to package installs, so the budget covers a cold
  // package manager cache.
  beforeAll(() => {
    projectDirectory = createTestProject();
    run(
      'pnpm add -Dw --config.frozen-lockfile=false --allow-build=nx --allow-build=@swc/core @code-lovers/nx-astro@e2e',
    );
    run(
      'pnpm nx g @code-lovers/nx-astro:application apps/site --no-interactive',
    );
  }, 600_000);

  afterAll(() => {
    if (projectDirectory)
      rmSync(dirname(projectDirectory), { recursive: true, force: true });
  });

  it('restores the build output of an Astro app from the cache', () => {
    const buildCommand = 'pnpm nx build site --output-style=static';

    expect(run(buildCommand)).not.toContain(CACHE_HIT);
    rmSync(join(projectDirectory, 'apps/site/dist'), { recursive: true });

    expect(run(buildCommand)).toContain(CACHE_HIT);
    expect(
      existsSync(join(projectDirectory, 'apps/site/dist/index.html')),
    ).toBe(true);
  }, 300_000);

  it('adds a graph edge from an Astro app to a library that a .astro file imports', () => {
    writeFile(
      'apps/ui/package.json',
      JSON.stringify({ name: '@acme/ui', private: true }),
    );
    // create-nx-workspace does not always write a packages glob for pnpm, and
    // without workspaces a folder with only a package.json is not a project.
    writeFile('apps/ui/project.json', JSON.stringify({ name: '@acme/ui' }));
    writeFile('apps/ui/Button.astro', '<button><slot /></button>\n');
    writeFile(
      'apps/site/src/pages/ui.astro',
      "---\nimport Button from '@acme/ui/Button.astro';\n---\n<Button>Go</Button>\n",
    );

    // The verbose output shows why the plugin found no edge, for example when
    // the Astro compiler does not load on the platform.
    const graphOutput = run(
      'NX_VERBOSE_LOGGING=true pnpm nx graph --file=graph.json',
    );
    const { graph } = JSON.parse(
      readFileSync(join(projectDirectory, 'graph.json'), 'utf-8'),
    );

    expect(graph.dependencies.site, graphOutput).toContainEqual({
      source: 'site',
      target: '@acme/ui',
      type: 'static',
    });
  }, 300_000);
});

function createTestProject() {
  const projectName = 'test-project';
  const parentDirectory = mkdtempSync(join(tmpdir(), 'nx-astro-e2e-'));

  execSync(
    `pnpm dlx create-nx-workspace@${nxVersion} ${projectName} --preset apps --nxCloud=skip --no-interactive --packageManager=pnpm`,
    { cwd: parentDirectory, stdio: 'inherit', env: process.env },
  );

  return join(parentDirectory, projectName);
}
