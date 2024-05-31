import resolve from "@rollup/plugin-node-resolve";
import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import { DEFAULT_EXTENSIONS } from "@babel/core";
import json from "@rollup/plugin-json";
import { ModuleFormat, RollupOptions, defineConfig } from "rollup";

const commonExtensions = [".ts"].concat(DEFAULT_EXTENSIONS);

const commonConfig = (format: ModuleFormat): RollupOptions => ({
  input: "src/index.ts",
  output: {
    ...(format === "cjs"
      ? {
          esModule: true,
          exports: "named",
        }
      : {}),
    file: `dist/bundle.${format}.js`,
    format,
  },
  plugins: [
    resolve({ extensions: commonExtensions }),
    commonjs(),
    json(),
    babel({
      extensions: commonExtensions,
      babelHelpers: "runtime",
      exclude: /^(.+\/)?node_modules\/.+$/,
    }),
  ],
});

export default defineConfig(
  (["cjs", "esm"] as ModuleFormat[]).map(commonConfig)
);
