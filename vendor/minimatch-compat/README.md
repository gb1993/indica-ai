# Legacy minimatch API

ESLint 9 and its import, React and accessibility plugins require the callable
CommonJS API from minimatch 3. The root npm overrides route those dependencies
through this adapter; matching is performed entirely by minimatch 11.0.4 or newer.
TypeScript ESLint's minimatch dependency is overridden to the patched modern API.
Glob is upgraded to version 14 because its traversal must support the new
minimatch pattern representation.

The legacy import plugin's `makeRe(...).test(path)` call is implemented with
`Minimatch.match(path)`. The adapter does not produce regular expressions.
Its dependency uses the `minimatch-modern` npm alias to keep the modern package
separate from the legacy override.

This avoids forcing the incompatible module export shape on legacy callers.
Remove the adapter and overrides when upstream dependencies all require
minimatch >=11.0.1 and support its named exports.

Security advisory: https://github.com/advisories/GHSA-g3hv-75wg-m249

Validate the adapter with `node --test vendor/minimatch-compat/index.test.cjs`.
