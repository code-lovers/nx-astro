import { createRequire } from 'node:module';

export type AstroParser = (source: string) => unknown;

export type AstroParserLoad =
  | { readonly status: 'loaded'; readonly parse: AstroParser }
  | { readonly status: 'astro-not-found'; readonly reason: string }
  | { readonly status: 'compiler-unavailable'; readonly reason: string };

const COMPILER_PACKAGE = '@astrojs/compiler-rs';

const hasParseFunction = (value: unknown): value is { parse: AstroParser } =>
  typeof value === 'object' &&
  value !== null &&
  'parse' in value &&
  typeof value.parse === 'function';

const resolveAstroPackageJson = (fromDirectory: string) => {
  try {
    return {
      ok: true,
      path: require.resolve('astro/package.json', { paths: [fromDirectory] }),
    } as const;
  } catch (error) {
    return { ok: false, reason: String(error) } as const;
  }
};

const requireCompiler = (astroPackageJson: string): AstroParserLoad => {
  try {
    const compiler: unknown = createRequire(astroPackageJson)(COMPILER_PACKAGE);
    return hasParseFunction(compiler)
      ? { status: 'loaded', parse: compiler.parse }
      : {
          status: 'compiler-unavailable',
          reason: `${COMPILER_PACKAGE} has no parse function`,
        };
  } catch (error) {
    return { status: 'compiler-unavailable', reason: String(error) };
  }
};

// The compiler comes from the installed astro, so the plugin parses the syntax of that Astro version.
export const loadAstroParser = (fromDirectory: string): AstroParserLoad => {
  const astroPackageJson = resolveAstroPackageJson(fromDirectory);
  return astroPackageJson.ok
    ? requireCompiler(astroPackageJson.path)
    : { status: 'astro-not-found', reason: astroPackageJson.reason };
};
