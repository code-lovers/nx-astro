import { parseModule } from 'magicast';
import { getDefaultExportOptions } from 'magicast/helpers';
import { mapValues } from 'radashi';

export const ASTRO_CONFIG_FILE_NAMES = [
  'astro.config.mjs',
  'astro.config.js',
  'astro.config.ts',
  'astro.config.mts',
] as const;

const ASTRO_CONFIG_KEYS = ['root', 'outDir'] as const;

export type AstroConfigKey = (typeof ASTRO_CONFIG_KEYS)[number];

export type AstroConfigFacts = Readonly<Record<AstroConfigKey, string>>;

export type AstroConfigOverrides = Partial<
  Record<AstroConfigKey, string | undefined>
>;

export interface AstroConfigReadResult {
  readonly facts: AstroConfigFacts;
  readonly nonLiteralKeys: readonly AstroConfigKey[];
  readonly parseError?: string;
}

export const ASTRO_CONFIG_DEFAULTS: AstroConfigFacts = {
  root: '.',
  outDir: './dist',
};

type ConfigValue =
  | { readonly kind: 'literal'; readonly value: string }
  | { readonly kind: 'absent' }
  | { readonly kind: 'non-literal' };

type ParsedOptions =
  | { readonly ok: true; readonly options: Record<string, unknown> }
  | { readonly ok: false; readonly error: string };

const parseDefaultExportOptions = (source: string): ParsedOptions => {
  try {
    return { ok: true, options: getDefaultExportOptions(parseModule(source)) };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
};

const readKey = (
  options: Record<string, unknown>,
  key: AstroConfigKey,
): ConfigValue => {
  try {
    const value = options[key];
    if (typeof value === 'string') return { kind: 'literal', value };
    return value === undefined ? { kind: 'absent' } : { kind: 'non-literal' };
  } catch {
    // magicast throws when it cannot turn an expression, such as a template literal, into a value.
    return { kind: 'non-literal' };
  }
};

const resolveKey = (
  options: Record<string, unknown>,
  overrides: AstroConfigOverrides,
  key: AstroConfigKey,
): ConfigValue => {
  const override = overrides[key];
  return override === undefined
    ? readKey(options, key)
    : { kind: 'literal', value: override };
};

export const readAstroConfig = (
  source: string,
  overrides: AstroConfigOverrides = {},
): AstroConfigReadResult => {
  const parsed = parseDefaultExportOptions(source);
  const options = parsed.ok ? parsed.options : {};
  const values = mapValues(ASTRO_CONFIG_DEFAULTS, (_default, key) =>
    resolveKey(options, overrides, key),
  );

  return {
    facts: mapValues(values, (value, key) =>
      value.kind === 'literal' ? value.value : ASTRO_CONFIG_DEFAULTS[key],
    ),
    nonLiteralKeys: ASTRO_CONFIG_KEYS.filter(
      (key) => values[key].kind === 'non-literal',
    ),
    ...(parsed.ok ? {} : { parseError: parsed.error }),
  };
};
