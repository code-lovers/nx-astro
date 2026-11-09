import {
  ASTRO_CONFIG_DEFAULTS,
  ASTRO_CONFIG_FILE_NAMES,
  readAstroConfig,
} from './read-astro-config';

const withDefineConfig = (body: string) =>
  `import { defineConfig } from 'astro/config';\nexport default defineConfig(${body});\n`;

describe('readAstroConfig', () => {
  it('uses the Astro defaults when the config sets none of the keys', () => {
    const result = readAstroConfig(withDefineConfig('{ integrations: [] }'));

    expect(result).toEqual({
      facts: ASTRO_CONFIG_DEFAULTS,
      nonLiteralKeys: [],
    });
  });

  it('reads string literals passed to defineConfig', () => {
    const result = readAstroConfig(
      withDefineConfig(
        "{ root: './site', srcDir: 'app', publicDir: 'static', outDir: './build' }",
      ),
    );

    expect(result.facts).toEqual({
      root: './site',
      srcDir: 'app',
      publicDir: 'static',
      outDir: './build',
    });
    expect(result.nonLiteralKeys).toEqual([]);
  });

  it('reads string literals from a plain default export object', () => {
    const result = readAstroConfig("export default { outDir: 'www' };\n");

    expect(result.facts).toEqual({ ...ASTRO_CONFIG_DEFAULTS, outDir: 'www' });
  });

  it('reads string literals wrapped in TypeScript assertions', () => {
    const result = readAstroConfig(
      withDefineConfig("{ outDir: 'dist-ts' as const }"),
    );

    expect(result.facts.outDir).toBe('dist-ts');
  });

  it('falls back to the default and reports each key that is not a literal', () => {
    const source = [
      "import { defineConfig } from 'astro/config';",
      "const out = process.env.OUT ?? 'dist';",
      'export default defineConfig({ outDir: out, srcDir: `s${1}` });',
    ].join('\n');

    const result = readAstroConfig(source);

    expect(result.facts).toEqual(ASTRO_CONFIG_DEFAULTS);
    expect(result.nonLiteralKeys).toEqual(['srcDir', 'outDir']);
  });

  it('lets each defined override win over the literal and the default', () => {
    const result = readAstroConfig(withDefineConfig("{ outDir: './build' }"), {
      outDir: 'override-out',
      srcDir: 'override-src',
      publicDir: undefined,
    });

    expect(result.facts).toEqual({
      ...ASTRO_CONFIG_DEFAULTS,
      outDir: 'override-out',
      srcDir: 'override-src',
    });
  });

  it('does not report a non-literal key that an override replaces', () => {
    const result = readAstroConfig(withDefineConfig('{ outDir: computed() }'), {
      outDir: 'override-out',
    });

    expect(result.nonLiteralKeys).toEqual([]);
  });

  it('uses the defaults and reports the error when the file does not parse', () => {
    const result = readAstroConfig('export default defineConfig({ outDir: ');

    expect(result.facts).toEqual(ASTRO_CONFIG_DEFAULTS);
    expect(result.parseError).toEqual(expect.any(String));
  });

  it('does not follow a default export that is a variable', () => {
    const result = readAstroConfig(
      "const config = { outDir: 'build' };\nexport default config;\n",
    );

    expect(result.facts).toEqual(ASTRO_CONFIG_DEFAULTS);
  });

  it('keeps the parse error out of a result that parsed', () => {
    const result = readAstroConfig(withDefineConfig('{}'));

    expect(result).not.toHaveProperty('parseError');
  });
});

describe('ASTRO_CONFIG_DEFAULTS', () => {
  it('matches the defaults of astro 7 in dist/core/config/schemas/defaults.js', () => {
    expect(ASTRO_CONFIG_DEFAULTS).toEqual({
      root: '.',
      srcDir: './src',
      publicDir: './public',
      outDir: './dist',
    });
  });
});

describe('ASTRO_CONFIG_FILE_NAMES', () => {
  it('lists the config files in the order that Astro 7 resolves them', () => {
    expect(ASTRO_CONFIG_FILE_NAMES).toEqual([
      'astro.config.mjs',
      'astro.config.js',
      'astro.config.ts',
      'astro.config.mts',
    ]);
  });
});
