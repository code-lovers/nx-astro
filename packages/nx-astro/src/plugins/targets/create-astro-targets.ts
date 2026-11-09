import { posix } from 'node:path';
import type { TargetConfiguration } from '@nx/devkit';
import type { AstroConfigFacts } from '../config/read-astro-config';

export const DEFAULT_TARGET_NAMES = {
  build: 'build',
  dev: 'dev',
  preview: 'preview',
  check: 'check',
  sync: 'sync',
} as const;

export type AstroTargetNames = Readonly<
  Record<keyof typeof DEFAULT_TARGET_NAMES, string>
>;

export interface AstroTargetsInput {
  readonly projectRoot: string;
  readonly facts: AstroConfigFacts;
  readonly targetNames: AstroTargetNames;
  readonly hasAstroCheck: boolean;
  readonly namedInputs: Readonly<Record<string, unknown>>;
}

const ASTRO_DEPENDENCY = { externalDependencies: ['astro'] };
const CHECK_DEPENDENCIES = {
  externalDependencies: ['astro', '@astrojs/check', 'typescript'],
};

const metadata = (description: string) => ({
  technologies: ['astro'],
  description,
});

const isOutsideProject = (projectPath: string) =>
  projectPath === '..' || projectPath.startsWith('../');

const toOutputPath = (projectRoot: string, path: string): string => {
  const workspacePath = posix.join(projectRoot, path);
  const projectPath = posix.relative(projectRoot, workspacePath);
  return isOutsideProject(projectPath)
    ? `{workspaceRoot}/${workspacePath}`
    : `{projectRoot}/${projectPath}`;
};

export const createAstroTargets = ({
  projectRoot,
  facts,
  targetNames,
  hasAstroCheck,
  namedInputs,
}: AstroTargetsInput): Record<string, TargetConfiguration> => {
  const inputName = 'production' in namedInputs ? 'production' : 'default';
  const options = { cwd: projectRoot };
  const generatedTypesDir = toOutputPath(
    projectRoot,
    posix.join(facts.root, '.astro'),
  );

  return {
    [targetNames.build]: {
      command: 'astro build',
      options,
      cache: true,
      dependsOn: [`^${targetNames.build}`],
      inputs: [inputName, `^${inputName}`, ASTRO_DEPENDENCY],
      outputs: [
        toOutputPath(projectRoot, posix.join(facts.root, facts.outDir)),
        generatedTypesDir,
      ],
      metadata: metadata('Builds the Astro site.'),
    },
    [targetNames.sync]: {
      command: 'astro sync',
      options,
      cache: true,
      inputs: [inputName, ASTRO_DEPENDENCY],
      outputs: [generatedTypesDir],
      metadata: metadata('Generates the types of the Astro project.'),
    },
    [targetNames.dev]: {
      command: 'astro dev',
      options,
      continuous: true,
      metadata: metadata('Starts the Astro dev server.'),
    },
    [targetNames.preview]: {
      command: 'astro preview',
      options,
      continuous: true,
      dependsOn: [targetNames.build],
      metadata: metadata('Serves the built Astro site.'),
    },
    ...(hasAstroCheck && {
      [targetNames.check]: {
        command: 'astro check',
        options,
        cache: true,
        inputs: ['default', `^${inputName}`, CHECK_DEPENDENCIES],
        outputs: [],
        metadata: metadata(
          'Checks the Astro project for type and template errors.',
        ),
      },
    }),
  };
};
