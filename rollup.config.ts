import resolve from "@rollup/plugin-node-resolve";
import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";

import { defineConfig } from "rollup";

export default defineConfig([
  {
    input: "src/index.ts",
    output: {
      file: "dist/bundle.js",
      format: "cjs",
    },
    plugins: [
      resolve({ extensions: [".ts"] }),
      commonjs(),
      babel({
        extensions: [".ts"],
        babelHelpers: "runtime",
        include: ["src/**/*", "types/**/*"],
      }),
    ],
  },
  {
    input: "src/index.ts",
    output: {
      file: "dist/bundle.esm.js",
      format: "esm",
    },
    plugins: [
      resolve({ extensions: [".ts"] }),
      commonjs(),
      babel({
        extensions: [".ts"],
        babelHelpers: "runtime",
        include: ["src/**/*", "types/**/*"],
      }),
    ],
  }
]);
