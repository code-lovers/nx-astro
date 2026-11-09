import type { AstroParser } from './load-astro-parser';

export interface AstroImport {
  readonly specifier: string;
  readonly kind: 'static' | 'dynamic';
}

export interface AstroImportsResult {
  readonly imports: readonly AstroImport[];
  readonly errors: readonly string[];
}

type UnknownRecord = Readonly<Record<string, unknown>>;

type AstNode = UnknownRecord & { readonly type: string };

const STATIC_IMPORT_NODE_TYPES = [
  'ImportDeclaration',
  'ExportNamedDeclaration',
  'ExportAllDeclaration',
];

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null;

const isAstNode = (value: unknown): value is AstNode =>
  isRecord(value) && typeof value['type'] === 'string';

const childNodes = (node: AstNode): AstNode[] =>
  Object.values(node)
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter(isAstNode);

const literalSource = (node: AstNode): string | undefined => {
  const source = node['source'];
  return isAstNode(source) && typeof source['value'] === 'string'
    ? source['value']
    : undefined;
};

const isTypeOnly = (node: AstNode) =>
  node['importKind'] === 'type' || node['exportKind'] === 'type';

const importOf = (node: AstNode): AstroImport[] => {
  const specifier = literalSource(node);
  if (specifier === undefined) return [];
  if (node.type === 'ImportExpression') return [{ specifier, kind: 'dynamic' }];
  return STATIC_IMPORT_NODE_TYPES.includes(node.type) && !isTypeOnly(node)
    ? [{ specifier, kind: 'static' }]
    : [];
};

const collectImports = (node: AstNode): AstroImport[] => [
  ...importOf(node),
  ...childNodes(node).flatMap(collectImports),
];

const errorTexts = (diagnostics: unknown): string[] =>
  Array.isArray(diagnostics)
    ? diagnostics
        .filter(isRecord)
        .filter((diagnostic) => diagnostic['severity'] === 'error')
        .map((diagnostic) => String(diagnostic['text']))
    : [];

export const findAstroImports = (
  parse: AstroParser,
  source: string,
): AstroImportsResult => {
  const result = parse(source);
  const parsed = isRecord(result) ? result : {};
  const ast = parsed['ast'];

  return {
    imports: isAstNode(ast) ? collectImports(ast) : [],
    errors: errorTexts(parsed['diagnostics']),
  };
};
