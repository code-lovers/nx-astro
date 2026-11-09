import { DependencyType, type RawProjectGraphDependency } from '@nx/devkit';
import { unique } from 'radashi';
import { findAstroImports, type AstroImport } from './find-astro-imports';
import type { ImportResolver } from './create-import-resolver';
import type { AstroParser } from './load-astro-parser';

export interface AstroDependenciesInput {
  readonly projectFiles: Readonly<Record<string, readonly string[]>>;
  readonly readSource: (file: string) => string;
  readonly parse: AstroParser;
  readonly resolve: ImportResolver;
}

export interface AstroFileErrors {
  readonly file: string;
  readonly errors: readonly string[];
}

export interface AstroDependencies {
  readonly dependencies: readonly RawProjectGraphDependency[];
  readonly fileErrors: readonly AstroFileErrors[];
}

interface AstroFileReport {
  readonly dependencies: readonly RawProjectGraphDependency[];
  readonly errors: AstroFileErrors | undefined;
}

const DEPENDENCY_TYPES: Readonly<Record<AstroImport['kind'], DependencyType>> =
  {
    static: DependencyType.static,
    dynamic: DependencyType.dynamic,
  };

const toKey = ({ source, target, type }: RawProjectGraphDependency) =>
  `${source}\0${target}\0${type}`;

export const createAstroDependencies = ({
  projectFiles,
  readSource,
  parse,
  resolve,
}: AstroDependenciesInput): AstroDependencies => {
  const reportFile = (source: string, file: string): AstroFileReport => {
    const { imports, errors } = findAstroImports(parse, readSource(file));
    const dependencies = imports.flatMap(({ specifier, kind }) => {
      const target = resolve(file, specifier);
      return target === undefined || target === source
        ? []
        : [{ source, target, sourceFile: file, type: DEPENDENCY_TYPES[kind] }];
    });
    return {
      dependencies: unique(dependencies, toKey),
      errors: errors.length > 0 ? { file, errors } : undefined,
    };
  };

  const reports = Object.entries(projectFiles).flatMap(([project, files]) =>
    files.map((file) => reportFile(project, file)),
  );

  return {
    dependencies: reports.flatMap((report) => report.dependencies),
    fileErrors: reports.flatMap((report) =>
      report.errors ? [report.errors] : [],
    ),
  };
};
