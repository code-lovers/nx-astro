import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import {
  createNodesFromFiles,
  logger,
  type CreateNodes,
  type CreateNodesContext,
  type CreateNodesResult,
} from '@nx/devkit';
import { mapValues } from 'radashi';
import {
  ASTRO_CONFIG_FILE_NAMES,
  readAstroConfig,
  type AstroConfigKey,
  type AstroConfigReadResult,
} from './config/read-astro-config';
import {
  DEFAULT_TARGET_NAMES,
  createAstroTargets,
  type AstroTargetNames,
} from './targets/create-astro-targets';

type TargetNameOptions = {
  readonly [K in keyof AstroTargetNames as `${K}TargetName`]?: string;
};

type ConfigOverrideOptions = {
  readonly [K in AstroConfigKey]?: string;
};

export type AstroPluginOptions = TargetNameOptions & ConfigOverrideOptions;

export const ASTRO_CONFIG_GLOB = `**/{${ASTRO_CONFIG_FILE_NAMES.join(',')}}`;

const PROJECT_FILES = ['package.json', 'project.json'];

const configPriority = (configFile: string) =>
  ASTRO_CONFIG_FILE_NAMES.findIndex((name) => name === basename(configFile));

const isPickedByAstro = (configFile: string, configFiles: readonly string[]) =>
  !configFiles.some(
    (other) =>
      dirname(other) === dirname(configFile) &&
      configPriority(other) < configPriority(configFile),
  );

const isProjectRoot = (workspaceRoot: string, projectRoot: string) =>
  PROJECT_FILES.some((file) =>
    existsSync(join(workspaceRoot, projectRoot, file)),
  );

const resolvesAstroCheck = (absoluteProjectRoot: string) => {
  try {
    require.resolve('@astrojs/check', { paths: [absoluteProjectRoot] });
    return true;
  } catch {
    return false;
  }
};

const toTargetNames = (options: AstroPluginOptions): AstroTargetNames =>
  mapValues(
    DEFAULT_TARGET_NAMES,
    (defaultName, target) => options[`${target}TargetName`] ?? defaultName,
  );

const reportUnreadConfig = (
  configFile: string,
  { nonLiteralKeys, parseError }: AstroConfigReadResult,
) => {
  if (parseError !== undefined) {
    logger.verbose(
      `${configFile} does not parse, so @code-lovers/nx-astro uses the Astro defaults: ${parseError}`,
    );
  }
  if (nonLiteralKeys.length > 0) {
    logger.verbose(
      `${configFile}: ${nonLiteralKeys.join(', ')} is not a string literal, so @code-lovers/nx-astro uses the Astro default. Set the plugin option with the same name to override it.`,
    );
  }
};

const createAstroProject = (
  configFile: string,
  options: AstroPluginOptions,
  context: CreateNodesContext,
): CreateNodesResult => {
  const projectRoot = dirname(configFile);
  const configRead = readAstroConfig(
    readFileSync(join(context.workspaceRoot, configFile), 'utf-8'),
    { root: options.root, outDir: options.outDir },
  );
  reportUnreadConfig(configFile, configRead);

  return {
    projects: {
      [projectRoot]: {
        root: projectRoot,
        targets: createAstroTargets({
          projectRoot,
          facts: configRead.facts,
          targetNames: toTargetNames(options),
          hasAstroCheck: resolvesAstroCheck(
            join(context.workspaceRoot, projectRoot),
          ),
          namedInputs: context.nxJsonConfiguration.namedInputs ?? {},
        }),
      },
    },
  };
};

export const createNodes: CreateNodes<AstroPluginOptions> = [
  ASTRO_CONFIG_GLOB,
  (configFiles, options = {}, context) =>
    createNodesFromFiles(
      (configFile, fileOptions, fileContext) =>
        createAstroProject(configFile, fileOptions ?? {}, fileContext),
      configFiles.filter(
        (configFile) =>
          isPickedByAstro(configFile, configFiles) &&
          isProjectRoot(context.workspaceRoot, dirname(configFile)),
      ),
      options,
      context,
    ),
];

export { createDependencies } from './graph/create-dependencies';
