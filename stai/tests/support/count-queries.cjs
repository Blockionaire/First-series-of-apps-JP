/**
 * Preloaded into the test server (NODE_OPTIONS=--require) by
 * tests/query-budget.test.mjs. Appends one line to $STAI_QUERY_LOG for every
 * SQL statement the server prepares. The Node driver prepares every call,
 * including each statement of a batch, so lines = queries — the same count
 * D1 would bill and limit.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- a CommonJS preload, loaded with --require */
const Module = require("module");
const fs = require("fs");

const LOG = process.env.STAI_QUERY_LOG;
const load = Module._load;
Module._load = function (request) {
  const mod = load.apply(this, arguments);
  if (LOG && request === "better-sqlite3" && !mod.__queryCounted) {
    const prepare = mod.prototype.prepare;
    mod.prototype.prepare = function (sql) {
      fs.appendFileSync(LOG, String(sql).replace(/\s+/g, " ").trim() + "\n");
      return prepare.apply(this, arguments);
    };
    mod.__queryCounted = true;
  }
  return mod;
};
