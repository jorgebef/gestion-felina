// Expo's Metro config already handles the pnpm monorepo (workspace packages are
// symlinked and resolved through package exports). Uniwind compiles Tailwind classes.
const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withUniwindConfig(config, {
  cssEntryFile: "./src/global.css",
  dtsFile: "./src/uniwind-types.d.ts",
});
