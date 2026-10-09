// Lets server-only modules load under `npm test`: Next bundles `server-only` itself, so it isn't in node_modules.
const Module = require("node:module");

const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only") return require.resolve("next/dist/compiled/server-only/empty.js");
  return resolve.call(this, request, ...rest);
};
