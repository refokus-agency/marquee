/**
 * Validates the package entry points before publish.
 *
 * This package is ESM-only. Neither publint nor attw can tell a correct
 * ESM-only package apart from one that wrongly declares a `require`
 * condition pointing at an ESM file: publint accepts both, attw --profile
 * esm-only accepts both, and attw's strict profile rejects both. So the
 * shape of the entry points is asserted here instead.
 *
 * Runs as part of `npm run validate:package`, which `build` chains after
 * the compiled output is emitted.
 */

import { existsSync, readFileSync } from 'node:fs';

const PACKAGE_JSON_URL = new URL('../package.json', import.meta.url);
const BROWSER_BUNDLE = './dist/marquee.browser.js';
const ESM_ENTRY = './dist/index.js';
const TYPES_ENTRY = './dist/index.d.ts';
const EXPECTED_CONDITIONS = ['types', 'import'];

/** Resolves a package-relative path (./dist/x) against the repository root. */
const fromRoot = (relativePath) => new URL(`../${relativePath}`, import.meta.url);

/**
 * Each rule maps to an acceptance criterion of issue #55.
 * `isValid` receives the parsed package.json and returns true when the rule holds.
 */
const RULES = [
  {
    id: 'no-main',
    isValid: (pkg) => !('main' in pkg),
    message:
      '"main" must be absent. It predates the exports map and would let ' +
      'pre-exports tooling load an ESM file as CommonJS.',
  },
  {
    id: 'no-module',
    isValid: (pkg) => !('module' in pkg),
    message:
      '"module" must be absent. It is a bundler-only convention superseded ' +
      'by the "import" condition.',
  },
  {
    id: 'no-require-condition',
    isValid: (pkg) => !pkg.exports?.['.']?.require,
    message:
      'exports["."] must not declare a "require" condition. dist/index.js is ' +
      'ESM, so require() would resolve to an ESM file — this is the bug from #55.',
  },
  {
    id: 'exact-conditions',
    isValid: (pkg) => {
      const conditions = Object.keys(pkg.exports?.['.'] ?? {});
      return conditions.join(',') === EXPECTED_CONDITIONS.join(',');
    },
    message:
      `exports["."] must declare exactly ${EXPECTED_CONDITIONS.map((c) => `"${c}"`).join(' then ')}, ` +
      'in that order. "types" must come first so TypeScript resolves it.\n' +
      '      This is a deliberate allowlist, not only a "require" check. Adding a legitimate ' +
      'condition\n      (e.g. "browser" or a "default" fallback) is a valid change — extend ' +
      'EXPECTED_CONDITIONS\n      in this script along with it. Never add "require": that is the ' +
      'regression from #55.',
  },
  {
    id: 'jsdelivr-points-at-browser-bundle',
    isValid: (pkg) => pkg.jsdelivr === BROWSER_BUNDLE,
    message:
      `"jsdelivr" must be "${BROWSER_BUNDLE}". jsDelivr ignores the exports ` +
      'map, so this is the only way to steer it at the bundled build.',
  },
  {
    id: 'referenced-files-exist',
    isValid: () => [TYPES_ENTRY, ESM_ENTRY, BROWSER_BUNDLE].every((p) => existsSync(fromRoot(p))),
    message:
      `${[TYPES_ENTRY, ESM_ENTRY, BROWSER_BUNDLE].join(', ')} must all exist on disk. ` +
      'The entry-point map can be perfectly shaped and still point at nothing if tsc or vite ' +
      'produced no output, so the targets are checked rather than assumed.',
  },
];

function main() {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON_URL, 'utf8'));
  const failures = RULES.filter((rule) => !rule.isValid(pkg));

  if (failures.length > 0) {
    console.error('Invalid package entry points:\n');
    for (const { id, message } of failures) {
      console.error(`  [${id}] ${message}\n`);
    }
    process.exit(1);
  }

  console.log(`package entry points OK (${RULES.length} rules checked)`);
}

main();
