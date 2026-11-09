import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { findAstroImports } from './find-astro-imports';
import { loadAstroParser, type AstroParser } from './load-astro-parser';

const loadWorkspaceParser = (): AstroParser => {
  const load = loadAstroParser(process.cwd());
  if (load.status !== 'loaded') throw new Error(load.reason);
  return load.parse;
};

const page = (frontmatter: string, template = '<p />') =>
  `---\n${frontmatter}\n---\n${template}\n`;

describe('findAstroImports', () => {
  const parser = loadWorkspaceParser();
  const importsOf = (source: string) => findAstroImports(parser, source);

  it('reports the static imports of the frontmatter', () => {
    const result = importsOf(
      page(
        [
          "import Layout from '../layouts/Layout.astro';",
          "import { format } from '@scope/shared';",
          "import './side-effect';",
        ].join('\n'),
      ),
    );

    expect(result).toEqual({
      imports: [
        { specifier: '../layouts/Layout.astro', kind: 'static' },
        { specifier: '@scope/shared', kind: 'static' },
        { specifier: './side-effect', kind: 'static' },
      ],
      errors: [],
    });
  });

  it('skips type-only imports and keeps imports that mix types and values', () => {
    const { imports } = importsOf(
      page(
        [
          "import type { Props } from '../types';",
          "import { type Item, load } from '@scope/data';",
        ].join('\n'),
      ),
    );

    expect(imports).toEqual([{ specifier: '@scope/data', kind: 'static' }]);
  });

  it('skips an import() inside a type', () => {
    const { imports } = importsOf(
      page("type Shape = import('../types').Shape;"),
    );

    expect(imports).toEqual([]);
  });

  it('reports re-exports and skips type-only re-exports', () => {
    const { imports } = importsOf(
      page(
        [
          "export { helper } from './helper';",
          "export * from './all';",
          "export type { Shape } from './shapes';",
        ].join('\n'),
      ),
    );

    expect(imports).toEqual([
      { specifier: './helper', kind: 'static' },
      { specifier: './all', kind: 'static' },
    ]);
  });

  it('reports dynamic imports of a string literal only', () => {
    const { imports } = importsOf(
      page(
        [
          "const lazy = await import('../lib/lazy');",
          'const byName = await import(name);',
          'const byTemplate = await import(`./${name}`);',
          'const byNumber = await import(42);',
        ].join('\n'),
      ),
    );

    expect(imports).toEqual([{ specifier: '../lib/lazy', kind: 'dynamic' }]);
  });

  it('reports the imports of script tags in the template', () => {
    const { imports } = importsOf(
      page('', "<script>import '../lib/client';</script>"),
    );

    expect(imports).toEqual([{ specifier: '../lib/client', kind: 'static' }]);
  });

  it('does not report a CSS @import', () => {
    const { imports } = importsOf(
      page('', "<style>@import '../styles/base.css';</style>"),
    );

    expect(imports).toEqual([]);
  });

  it('reports nothing for a file without frontmatter or scripts', () => {
    expect(importsOf('<p>Hello</p>\n')).toEqual({ imports: [], errors: [] });
  });

  it('keeps the frontmatter imports and reports the error of a broken template', () => {
    const result = importsOf(
      page("import Card from './Card.astro';", '<div><span></div>'),
    );

    expect(result.imports).toEqual([
      { specifier: './Card.astro', kind: 'static' },
    ]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Expected corresponding JSX closing tag'),
      ]),
    );
  });
});

describe('findAstroImports with a parser of another shape', () => {
  it('reports only the diagnostics with the error severity', () => {
    const parse = () => ({
      ast: { type: 'Root' },
      diagnostics: [
        { severity: 'warning', text: 'unused' },
        { severity: 'error', text: 'broken' },
      ],
    });

    expect(findAstroImports(parse, '')).toEqual({
      imports: [],
      errors: ['broken'],
    });
  });

  it('reports nothing when the parser returns no object', () => {
    expect(findAstroImports(() => undefined, '')).toEqual({
      imports: [],
      errors: [],
    });
  });
});

describe('loadAstroParser', () => {
  let directory: string;

  const writeFile = (path: string, content: string) => {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), content);
  };

  const writeAstroWithCompiler = (compilerSource: string) => {
    writeFile(
      'node_modules/astro/package.json',
      '{ "name": "astro", "exports": { "./package.json": "./package.json" } }',
    );
    writeFile(
      'node_modules/astro/node_modules/@astrojs/compiler-rs/package.json',
      '{ "name": "@astrojs/compiler-rs", "main": "index.js" }',
    );
    writeFile(
      'node_modules/astro/node_modules/@astrojs/compiler-rs/index.js',
      compilerSource,
    );
  };

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'nx-astro-parser-'));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('loads the parser of the compiler that the installed astro depends on', () => {
    const load = loadAstroParser(process.cwd());

    expect(load.status).toBe('loaded');
  });

  it('reports astro-not-found when astro does not resolve from the directory', () => {
    expect(loadAstroParser(directory)).toEqual({
      status: 'astro-not-found',
      reason: expect.stringContaining('astro/package.json'),
    });
  });

  it('reports compiler-unavailable with the error when the compiler does not load', () => {
    writeAstroWithCompiler("throw new Error('missing native binding');");

    expect(loadAstroParser(directory)).toEqual({
      status: 'compiler-unavailable',
      reason: expect.stringContaining('missing native binding'),
    });
  });

  it('reports compiler-unavailable when the compiler has no parse function', () => {
    writeAstroWithCompiler('module.exports = { transform() {} };');

    expect(loadAstroParser(directory)).toEqual({
      status: 'compiler-unavailable',
      reason: '@astrojs/compiler-rs has no parse function',
    });
  });

  it('loads the parse function of a compiler next to astro', () => {
    writeAstroWithCompiler('module.exports = { parse: () => "parsed" };');

    const load = loadAstroParser(directory);

    expect(load.status === 'loaded' && load.parse('')).toBe('parsed');
  });
});
