// minimatch 3 exported a callable function; modern versions use named exports.
// Keep legacy ESLint plugins working while delegating matching to patched code.
/* eslint-disable @typescript-eslint/no-require-imports -- Legacy consumers require CommonJS. */
const { minimatch } = require("minimatch-modern");

// import/no-internal-modules only uses makeRe(...).test(path). Version 11
// deliberately no longer builds regular expressions; keep its safe matcher.
module.exports = Object.assign(
  (path, pattern, options) => minimatch(path, pattern, options),
  minimatch,
  {
    makeRe: (pattern, options) => {
      const matcher = new minimatch.Minimatch(pattern, options);
      return { test: (path) => matcher.match(path) };
    },
  },
);
