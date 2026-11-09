import { posix } from 'node:path';
import { readJson, writeJson, type Tree } from '@nx/devkit';
import { isSeq, parseDocument } from 'yaml';

interface WorkspacesFile {
  readonly patterns: readonly string[];
  readonly add: (pattern: string) => void;
}

interface PackageJson {
  readonly workspaces?: unknown;
}

const PNPM_WORKSPACE = 'pnpm-workspace.yaml';

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

const patternsOf = (value: unknown) =>
  Array.isArray(value) ? value.map(String) : undefined;

const pnpmWorkspacesFile = (tree: Tree): WorkspacesFile | undefined => {
  const document = parseDocument(tree.read(PNPM_WORKSPACE, 'utf-8') ?? '');
  const packages = document.get('packages');
  if (!isSeq(packages)) return undefined;

  return {
    patterns: packages.toJSON().map(String),
    add: (pattern) => {
      packages.add(pattern);
      tree.write(PNPM_WORKSPACE, document.toString());
    },
  };
};

const packageJsonWorkspacesFile = (tree: Tree): WorkspacesFile | undefined => {
  const packageJson = readJson<PackageJson>(tree, 'package.json');
  const { workspaces } = packageJson;

  const arrayPatterns = patternsOf(workspaces);
  if (arrayPatterns)
    return {
      patterns: arrayPatterns,
      add: (pattern) =>
        writeJson(tree, 'package.json', {
          ...packageJson,
          workspaces: [...arrayPatterns, pattern],
        }),
    };

  if (!isRecord(workspaces)) return undefined;
  const packages = patternsOf(workspaces['packages']);
  if (!packages) return undefined;

  return {
    patterns: packages,
    add: (pattern) =>
      writeJson(tree, 'package.json', {
        ...packageJson,
        workspaces: { ...workspaces, packages: [...packages, pattern] },
      }),
  };
};

const workspacesFileOf = (tree: Tree) =>
  tree.exists(PNPM_WORKSPACE)
    ? pnpmWorkspacesFile(tree)
    : packageJsonWorkspacesFile(tree);

const includes = (patterns: readonly string[], directory: string) =>
  patterns.some((pattern) => posix.matchesGlob(directory, pattern));

const patternFor = (
  tree: Tree,
  patterns: readonly string[],
  directory: string,
) => {
  const parent = posix.dirname(directory);
  if (parent === '.') return directory;

  const matchesOtherPackages = tree
    .children(parent)
    .map((child) => posix.join(parent, child))
    .some(
      (sibling) =>
        sibling !== directory &&
        tree.exists(posix.join(sibling, 'package.json')) &&
        !includes(patterns, sibling),
    );
  return matchesOtherPackages ? directory : `${parent}/*`;
};

export const isUsingWorkspaces = (tree: Tree) =>
  workspacesFileOf(tree) !== undefined;

export const addProjectToWorkspaces = (tree: Tree, projectRoot: string) => {
  const workspacesFile = workspacesFileOf(tree);
  if (!workspacesFile || includes(workspacesFile.patterns, projectRoot)) return;

  workspacesFile.add(patternFor(tree, workspacesFile.patterns, projectRoot));
};
