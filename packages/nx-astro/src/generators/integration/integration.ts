import { posix } from 'node:path';
import {
  readProjectConfiguration,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { ASTRO_CONFIG_FILE_NAMES } from '../../plugins/config/read-astro-config';
import { assertIntegrationNames, astroAddTask } from '../utils/astro-add';
import type { IntegrationGeneratorSchema } from './schema';

export const integrationGenerator = async (
  tree: Tree,
  { project, integrations }: IntegrationGeneratorSchema,
): Promise<GeneratorCallback> => {
  if (integrations.length === 0)
    throw new Error(
      'Pass at least one integration, for example --integrations=react.',
    );
  assertIntegrationNames(integrations);

  const { root } = readProjectConfiguration(tree, project);
  const hasAstroConfig = ASTRO_CONFIG_FILE_NAMES.some((fileName) =>
    tree.exists(posix.join(root, fileName)),
  );
  if (!hasAstroConfig)
    throw new Error(
      `${project} has no astro.config file in ${root}. Pass an Astro project.`,
    );

  return astroAddTask(tree, root, integrations);
};

export default integrationGenerator;
