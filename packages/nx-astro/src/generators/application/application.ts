import { join, posix } from 'node:path';
import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  getProjects,
  installPackagesTask,
  writeJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { isPackageName } from '../../utils/package-name';
import { astroVersion } from '../../utils/versions';
import { initGenerator } from '../init/init';
import {
  addProjectToWorkspaces,
  isUsingWorkspaces,
} from '../utils/add-project-to-workspaces';
import { assertIntegrationNames, astroAddTask } from '../utils/astro-add';
import type { ApplicationGeneratorSchema } from './schema';

interface NormalizedOptions {
  readonly projectRoot: string;
  readonly name: string;
  readonly tags: readonly string[];
  readonly integrations: readonly string[];
}

const normalizeOptions = (
  tree: Tree,
  options: ApplicationGeneratorSchema,
): NormalizedOptions => {
  const projectRoot = posix.normalize(options.directory);
  if (projectRoot.split('/')[0] === '..' || posix.isAbsolute(projectRoot))
    throw new Error(
      `${options.directory} is outside the workspace. Pass a directory relative to the workspace root.`,
    );
  if (tree.exists(posix.join(projectRoot, 'package.json')))
    throw new Error(
      `${projectRoot} already has a package.json. Pass a directory without a project.`,
    );

  const name = options.name ?? posix.basename(projectRoot);
  if (!isPackageName(name))
    throw new Error(
      `"${name}" is not a valid package name. Pass a --name such as "site" or "@acme/site".`,
    );

  const existing = getProjects(tree).get(name);
  if (existing)
    throw new Error(
      `"${name}" is already the name of the project in ${existing.root}. Pass another --name.`,
    );

  const integrations = options.integrations ?? [];
  assertIntegrationNames(integrations);

  const tags = (options.tags ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '');

  return { projectRoot, name, tags, integrations };
};

// A project with its own package.json joins the package manager workspaces.
// Without workspaces it gets a project.json, and `astro add` installs into the
// root package.json, as the other Nx generators do.
const writeWorkspacePackage = (tree: Tree, options: NormalizedOptions) => {
  writeJson(tree, posix.join(options.projectRoot, 'package.json'), {
    name: options.name,
    private: true,
    type: 'module',
    dependencies: { astro: astroVersion },
    ...(options.tags.length > 0 && { nx: { tags: options.tags } }),
  });
  addProjectToWorkspaces(tree, options.projectRoot);
};

const writeProjectConfiguration = (tree: Tree, options: NormalizedOptions) =>
  addProjectConfiguration(tree, options.name, {
    root: options.projectRoot,
    projectType: 'application',
    sourceRoot: posix.join(options.projectRoot, 'src'),
    tags: [...options.tags],
  });

const writeProject = (
  tree: Tree,
  options: NormalizedOptions,
  usesWorkspaces: boolean,
) => {
  generateFiles(tree, join(__dirname, 'files'), options.projectRoot, {
    name: options.name,
    tmpl: '',
  });
  if (usesWorkspaces) writeWorkspacePackage(tree, options);
  else writeProjectConfiguration(tree, options);
};

export const applicationGenerator = async (
  tree: Tree,
  schema: ApplicationGeneratorSchema,
): Promise<GeneratorCallback> => {
  const options = normalizeOptions(tree, schema);

  await initGenerator(tree, { skipFormat: true });
  writeProject(tree, options, isUsingWorkspaces(tree));
  if (!schema.skipFormat) await formatFiles(tree);

  return () => {
    installPackagesTask(tree, true);
    if (options.integrations.length > 0)
      astroAddTask(tree, options.projectRoot, options.integrations)();
  };
};

export default applicationGenerator;
