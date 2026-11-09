import { posix } from 'node:path';

export interface ImportResolutionIndex {
  readonly projectRoots: Readonly<Record<string, string>>;
  readonly packageProjects: Readonly<Record<string, string>>;
  readonly tsconfigPaths: Readonly<Record<string, readonly string[]>>;
}

export type ImportResolver = (
  fromFile: string,
  specifier: string,
) => string | undefined;

const isRelative = (specifier: string) =>
  specifier.startsWith('./') || specifier.startsWith('../');

const isInsideWorkspace = (path: string) =>
  path !== '..' && !path.startsWith('../');

const contains = (root: string, path: string) =>
  root === '.' || path === root || path.startsWith(`${root}/`);

const packageNameOf = (specifier: string) => {
  const segments = specifier.split('/');
  return specifier.startsWith('@')
    ? segments.slice(0, 2).join('/')
    : segments[0];
};

const wildcardMatch = (
  pattern: string,
  specifier: string,
): string | undefined => {
  const wildcard = pattern.indexOf('*');
  if (wildcard === -1) return pattern === specifier ? '' : undefined;
  const prefix = pattern.slice(0, wildcard);
  const suffix = pattern.slice(wildcard + 1);
  return specifier.length >= prefix.length + suffix.length &&
    specifier.startsWith(prefix) &&
    specifier.endsWith(suffix)
    ? specifier.slice(prefix.length, specifier.length - suffix.length)
    : undefined;
};

const createProjectOfPath = (
  projectRoots: ImportResolutionIndex['projectRoots'],
) => {
  const byDeepestRoot = Object.entries(projectRoots)
    .map(([name, root]) => ({ name, root }))
    .sort((a, b) => b.root.length - a.root.length);

  return (path: string): string | undefined =>
    isInsideWorkspace(path)
      ? byDeepestRoot.find(({ root }) => contains(root, path))?.name
      : undefined;
};

export const createImportResolver = (
  index: ImportResolutionIndex,
): ImportResolver => {
  const projectOfPath = createProjectOfPath(index.projectRoots);

  const projectOfTsconfigPath = (specifier: string) => {
    for (const [pattern, targets] of Object.entries(index.tsconfigPaths)) {
      const captured = wildcardMatch(pattern, specifier);
      const target = targets[0];
      if (captured !== undefined && target !== undefined)
        return projectOfPath(posix.normalize(target.replace('*', captured)));
    }
    return undefined;
  };

  return (fromFile, specifier) =>
    isRelative(specifier)
      ? projectOfPath(posix.join(posix.dirname(fromFile), specifier))
      : (projectOfTsconfigPath(specifier) ??
        index.packageProjects[packageNameOf(specifier)]);
};
