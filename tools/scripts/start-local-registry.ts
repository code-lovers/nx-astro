/**
 * This script starts a local registry for e2e testing purposes.
 * It is meant to be called in jest's globalSetup.
 */

/// <reference path="registry.d.ts" />

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { workspaceRoot } from '@nx/devkit';
import { startLocalRegistry } from '@nx/js/plugins/jest/local-registry';
import { releasePublish, releaseVersion } from 'nx/release';

export default async () => {
  // local registry target to run
  const localRegistryTarget = '@code-lovers/source:local-registry';
  // storage folder for the local registry
  const storage = './tmp/local-registry/storage';

  global.stopLocalRegistry = await startLocalRegistry({
    localRegistryTarget,
    storage,
    verbose: false,
  });

  // releaseVersion writes 0.0.0-e2e into the package.json of the plugin.
  // The registry needs it only to publish, so the file gets its version back.
  const manifestPath = join(workspaceRoot, 'packages/nx-astro/package.json');
  const manifest = readFileSync(manifestPath, 'utf-8');
  try {
    await releaseVersion({
      specifier: '0.0.0-e2e',
      stageChanges: false,
      gitCommit: false,
      gitTag: false,
      firstRelease: true,
      versionActionsOptionsOverrides: {
        skipLockFileUpdate: true,
      },
    });
    await releasePublish({
      tag: 'e2e',
      firstRelease: true,
    });
  } finally {
    writeFileSync(manifestPath, manifest);
  }
};
