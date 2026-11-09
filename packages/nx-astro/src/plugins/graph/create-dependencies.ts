import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  logger,
  readJsonFile,
  type CreateDependencies,
  type CreateDependenciesContext,
} from '@nx/devkit';
import { mapValues } from 'radashi';
import type { AstroPluginOptions } from '../plugin';
import {
  createAstroDependencies,
  type AstroFileErrors,
} from './create-astro-dependencies';
import {
  createImportResolver,
  type ImportResolutionIndex,
} from './create-import-resolver';
import { loadAstroParser, type AstroParserLoad } from './load-astro-parser';

const TSCONFIG_FILES = ['tsconfig.base.json', 'tsconfig.json'];

type UnknownRecord = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null;

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const readJsonIfExists = (path: string): unknown =>
  existsSync(path) ? readJsonFile<object>(path) : undefined;

const packageProjectsOf = (
  workspaceRoot: string,
  projects: CreateDependenciesContext['projects'],
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(projects).flatMap(([project, { root }]) => {
      const packageJson = readJsonIfExists(
        join(workspaceRoot, root, 'package.json'),
      );
      const name = isRecord(packageJson) ? packageJson['name'] : undefined;
      return typeof name === 'string' ? [[name, project]] : [];
    }),
  );

const tsconfigPathsOf = (
  workspaceRoot: string,
): Record<string, readonly string[]> => {
  const tsconfigFile = TSCONFIG_FILES.map((file) =>
    join(workspaceRoot, file),
  ).find(existsSync);
  const tsconfig = tsconfigFile ? readJsonFile<object>(tsconfigFile) : {};
  const compilerOptions = isRecord(tsconfig)
    ? tsconfig['compilerOptions']
    : undefined;
  const paths = isRecord(compilerOptions)
    ? compilerOptions['paths']
    : undefined;
  return isRecord(paths)
    ? Object.fromEntries(
        Object.entries(paths).filter(
          (entry): entry is [string, readonly string[]] =>
            isStringArray(entry[1]),
        ),
      )
    : {};
};

const resolutionIndexOf = ({
  workspaceRoot,
  projects,
}: CreateDependenciesContext): ImportResolutionIndex => ({
  projectRoots: mapValues(projects, ({ root }) => root),
  packageProjects: packageProjectsOf(workspaceRoot, projects),
  tsconfigPaths: tsconfigPathsOf(workspaceRoot),
});

const reportUnloadedParser = (
  load: Exclude<AstroParserLoad, { status: 'loaded' }>,
) => {
  if (load.status === 'astro-not-found') {
    logger.verbose(
      `@code-lovers/nx-astro adds no dependencies from .astro files because astro does not resolve from the workspace root: ${load.reason}`,
    );
  } else {
    logger.warn(
      `@code-lovers/nx-astro cannot load the Astro compiler, so the project graph has no dependencies from .astro files: ${load.reason}`,
    );
  }
};

const reportFileErrors = ({ file, errors }: AstroFileErrors) =>
  logger.verbose(
    `${file} has syntax errors, so the project graph can miss some of its imports: ${errors.join('; ')}`,
  );

export const createDependencies: CreateDependencies<AstroPluginOptions> = (
  _options,
  context,
) => {
  const projectFiles = mapValues(
    context.filesToProcess.projectFileMap,
    (files) =>
      files.map(({ file }) => file).filter((file) => file.endsWith('.astro')),
  );
  if (Object.values(projectFiles).every((files) => files.length === 0)) {
    return [];
  }

  const load = loadAstroParser(context.workspaceRoot);
  if (load.status !== 'loaded') {
    reportUnloadedParser(load);
    return [];
  }

  const { dependencies, fileErrors } = createAstroDependencies({
    projectFiles,
    readSource: (file) =>
      readFileSync(join(context.workspaceRoot, file), 'utf-8'),
    parse: load.parse,
    resolve: createImportResolver(resolutionIndexOf(context)),
  });
  fileErrors.forEach(reportFileErrors);
  return [...dependencies];
};
