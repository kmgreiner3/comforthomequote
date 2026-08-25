// Bundles each Lambda handler into its own dist/<name>/index.mjs so the
// infra stack (Task 2) can zip `dist/<name>/` directly for archive_file.
import { build } from 'esbuild';

const HANDLERS = ['measure', 'vizUpload', 'vizGenerate'];

for (const name of HANDLERS) {
  await build({
    entryPoints: [`src/handlers/${name}.ts`],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    outfile: `dist/${name}/index.mjs`,
    // The AWS SDK v3 clients pull in CJS deps (e.g. @smithy/node-http-handler)
    // that `require()` Node builtins like `node:https` at load time. In an
    // ESM bundle there is no ambient `require`, so esbuild's synthetic shim
    // throws "Dynamic require ... is not supported" unless a real one is
    // provided up front via createRequire.
    banner: {
      js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
    },
  });
  // eslint-disable-next-line no-console
  console.log(`built dist/${name}/index.mjs`);
}
