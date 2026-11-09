import { DependencyType } from '@nx/devkit';
import { createAstroDependencies } from './create-astro-dependencies';
import { createImportResolver } from './create-import-resolver';
import { loadAstroParser, type AstroParser } from './load-astro-parser';

const loadWorkspaceParser = (): AstroParser => {
  const load = loadAstroParser(process.cwd());
  if (load.status !== 'loaded') throw new Error(load.reason);
  return load.parse;
};

const resolve = createImportResolver({
  projectRoots: { site: 'apps/site', ui: 'libs/ui', data: 'libs/data' },
  packageProjects: { '@acme/data': 'data' },
  tsconfigPaths: {},
});

const PAGE = 'apps/site/src/pages/index.astro';

describe('createAstroDependencies', () => {
  const parse = loadWorkspaceParser();

  const dependenciesOf = (
    sources: Readonly<Record<string, string>>,
    projectFiles: Readonly<Record<string, readonly string[]>> = {
      site: Object.keys(sources),
    },
  ) =>
    createAstroDependencies({
      projectFiles,
      readSource: (file) => sources[file] ?? '',
      parse,
      resolve,
    });

  it('reports a static edge for each project that a file imports', () => {
    const result = dependenciesOf({
      [PAGE]: [
        '---',
        "import Button from '../../../../libs/ui/Button.astro';",
        "import { load } from '@acme/data';",
        '---',
        '<Button />',
      ].join('\n'),
    });

    expect(result).toEqual({
      dependencies: [
        {
          source: 'site',
          target: 'ui',
          sourceFile: PAGE,
          type: DependencyType.static,
        },
        {
          source: 'site',
          target: 'data',
          sourceFile: PAGE,
          type: DependencyType.static,
        },
      ],
      fileErrors: [],
    });
  });

  it('reports a dynamic edge for an import() of a string literal', () => {
    const { dependencies } = dependenciesOf({
      [PAGE]: "---\nconst ui = await import('@acme/data');\n---\n",
    });

    expect(dependencies).toEqual([
      {
        source: 'site',
        target: 'data',
        sourceFile: PAGE,
        type: DependencyType.dynamic,
      },
    ]);
  });

  it('skips imports of the same project and imports that match no project', () => {
    const { dependencies } = dependenciesOf({
      [PAGE]: [
        '---',
        "import Layout from '../layouts/Layout.astro';",
        "import { z } from 'astro:content';",
        "import React from 'react';",
        '---',
      ].join('\n'),
    });

    expect(dependencies).toEqual([]);
  });

  it('reports one edge when a file imports the same project twice', () => {
    const { dependencies } = dependenciesOf({
      [PAGE]: [
        '---',
        "import { load } from '@acme/data';",
        "import { save } from '@acme/data/save';",
        '---',
        "<script>import '@acme/data';</script>",
      ].join('\n'),
    });

    expect(dependencies).toHaveLength(1);
  });

  it('reports a static and a dynamic edge to the same project apart', () => {
    const { dependencies } = dependenciesOf({
      [PAGE]: [
        '---',
        "import { load } from '@acme/data';",
        "const lazy = await import('@acme/data');",
        '---',
      ].join('\n'),
    });

    expect(dependencies.map(({ type }) => type)).toEqual([
      DependencyType.static,
      DependencyType.dynamic,
    ]);
  });

  it('reports the edges of every file in every project', () => {
    const CARD = 'libs/ui/Card.astro';
    const { dependencies } = dependenciesOf(
      {
        [PAGE]: "---\nimport '../../../../libs/ui/Card.astro';\n---\n",
        [CARD]: "---\nimport '@acme/data';\n---\n",
      },
      { site: [PAGE], ui: [CARD] },
    );

    expect(dependencies).toEqual([
      expect.objectContaining({ source: 'site', target: 'ui' }),
      expect.objectContaining({
        source: 'ui',
        target: 'data',
        sourceFile: CARD,
      }),
    ]);
  });

  it('keeps the edges of a file with a broken template and reports its errors', () => {
    const { dependencies, fileErrors } = dependenciesOf({
      [PAGE]: "---\nimport '@acme/data';\n---\n<div><span></div>\n",
    });

    expect(dependencies).toHaveLength(1);
    expect(fileErrors).toEqual([
      {
        file: PAGE,
        errors: expect.arrayContaining([
          expect.stringContaining('Expected corresponding JSX closing tag'),
        ]),
      },
    ]);
  });
});
