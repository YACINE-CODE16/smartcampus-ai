/**
 * Bundle des Lambdas (esbuild) → dist/lambda :
 *   http.mjs           Incidents, Dashboard, Assistant, Fichiers (même code, routage par API Gateway)
 *   notifications.mjs  EventBridge (US-18) + emails SES (US-10)
 *   migrate.mjs        migrations SQL + données de démo + comptes Cognito
 * Le SDK AWS est embarqué (versions maîtrisées, presigned-post absent du runtime).
 * Prisma 7 sans moteur Rust : le compilateur de requêtes WASM est inclus dans le JS, pas de binaryTargets.
 */
import { build } from 'esbuild';
import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const out = 'dist/lambda';
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const result = await build({
  entryPoints: ['src/lambda/http.ts', 'src/lambda/notifications.ts', 'src/lambda/migrate.ts'],
  outdir: out,
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  minify: true,
  keepNames: true,
  metafile: true,
  legalComments: 'none',
  // Modules optionnels de pg jamais utilisés sur Lambda.
  external: ['pg-native', 'pg-cloudflare'],
  // Les dépendances CommonJS embarquées appellent `require` : on le fournit en ESM.
  banner: {
    js: [
      "import { createRequire as __cr } from 'node:module';",
      "import { fileURLToPath as __fu } from 'node:url';",
      "import { dirname as __dn } from 'node:path';",
      'const require = __cr(import.meta.url);',
      'const __filename = __fu(import.meta.url);',
      'const __dirname = __dn(__filename);',
    ].join('\n'),
  },
  logLevel: 'warning',
});

await cp('prisma/migrations', join(out, 'migrations'), { recursive: true });
await cp('prisma/data', join(out, 'data'), { recursive: true });
// package.json minimal : `sam build` (builder npm) n'a rien à installer.
await writeFile(join(out, 'package.json'), JSON.stringify({ name: 'smartcampus-lambda', version: '1.0.0', private: true, type: 'module' }, null, 2));

let total = 0;
for (const f of await readdir(out)) {
  const s = await stat(join(out, f));
  if (s.isFile()) {
    total += s.size;
    if (f.endsWith('.mjs')) console.log(`  ${f.padEnd(20)} ${(s.size / 1e6).toFixed(1)} Mo`);
  }
}
console.log(`Bundle Lambda : ${(total / 1e6).toFixed(1)} Mo (limite Lambda : 250 Mo décompressé)`);
if (result.warnings.length) console.log(`${result.warnings.length} avertissement(s) esbuild`);
