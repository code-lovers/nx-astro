import { execSync } from 'node:child_process';
import { join } from 'node:path';
import {
  detectPackageManager,
  getPackageManagerCommand,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { isPackageName } from '../../utils/package-name';

export const assertIntegrationNames = (names: readonly string[]) => {
  const invalid = names.find((name) => !isPackageName(name));
  if (invalid !== undefined)
    throw new Error(
      `"${invalid}" is not a valid integration name. Pass names such as "react" or "@astrojs/mdx".`,
    );
};

export const astroAddTask =
  (
    tree: Tree,
    projectRoot: string,
    names: readonly string[],
  ): GeneratorCallback =>
  () => {
    const { exec } = getPackageManagerCommand(detectPackageManager(tree.root));
    execSync(`${exec} astro add ${names.join(' ')} --yes`, {
      cwd: join(tree.root, projectRoot),
      stdio: 'inherit',
    });
  };
