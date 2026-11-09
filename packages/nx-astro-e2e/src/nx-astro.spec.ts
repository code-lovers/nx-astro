import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { mkdirSync, rmSync } from 'fs';
import { version as nxVersion } from 'nx/package.json';

describe('nx-astro', () => {
  let projectDirectory: string;

  // This hook shells out synchronously twice, so its budget has to cover both
  // installs on a cold package manager cache. Otherwise work that succeeded
  // still fails on return.
  beforeAll(() => {
    projectDirectory = createTestProject();

    // The plugin has been built and published to a local registry in the globalSetup
    // Install the plugin built with the latest source code into the test repo
    execSync(
      `pnpm add -Dw --config.frozen-lockfile=false --allow-build=nx --allow-build=@swc/core @code-lovers/nx-astro@e2e`,
      {
        cwd: projectDirectory,
        stdio: 'inherit',
        env: process.env,
      },
    );
  }, 300_000);

  afterAll(() => {
    if (projectDirectory) {
      // Cleanup the test project
      rmSync(projectDirectory, {
        recursive: true,
        force: true,
      });
    }
  });

  it('should be installed', () => {
    // npm ls will fail if the package is not installed properly
    execSync('pnpm ls --depth 100 @code-lovers/nx-astro', {
      cwd: projectDirectory,
      stdio: 'inherit',
    });
  });
});

/**
 * Creates a test project with create-nx-workspace and installs the plugin
 * @returns The directory where the test project was created
 */
function createTestProject() {
  const projectName = 'test-project';
  const projectDirectory = join(process.cwd(), 'tmp', projectName);

  // Ensure projectDirectory is empty
  rmSync(projectDirectory, {
    recursive: true,
    force: true,
  });
  mkdirSync(dirname(projectDirectory), {
    recursive: true,
  });

  execSync(
    `pnpm dlx create-nx-workspace@${nxVersion} ${projectName} --preset apps --nxCloud=skip --no-interactive --packageManager=pnpm`,
    {
      cwd: dirname(projectDirectory),
      stdio: 'inherit',
      env: process.env,
    },
  );
  console.log(`Created test project in "${projectDirectory}"`);

  return projectDirectory;
}
