import {
  addDependenciesToPackageJson,
  formatFiles,
  readNxJson,
  updateNxJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { astroVersion } from '../../utils/versions';
import type { InitGeneratorSchema } from './schema';

const PLUGIN = '@code-lovers/nx-astro/plugin';

const registerPlugin = (tree: Tree) => {
  const nxJson = readNxJson(tree) ?? {};
  const plugins = nxJson.plugins ?? [];
  const isRegistered = plugins.some(
    (registration) =>
      (typeof registration === 'string'
        ? registration
        : registration.plugin) === PLUGIN,
  );
  if (!isRegistered) {
    updateNxJson(tree, { ...nxJson, plugins: [...plugins, PLUGIN] });
  }
};

export const initGenerator = async (
  tree: Tree,
  options: InitGeneratorSchema,
): Promise<GeneratorCallback> => {
  registerPlugin(tree);
  const install = addDependenciesToPackageJson(
    tree,
    {},
    { astro: astroVersion },
    undefined,
    true,
  );
  if (!options.skipFormat) {
    await formatFiles(tree);
  }
  return install;
};

export default initGenerator;
