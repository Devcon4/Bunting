import pluginJs from "@eslint/js";
import functional from "eslint-plugin-functional";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {files: ["**/*.{js,mjs,cjs,ts}"]},
  {languageOptions: { globals: {...globals.browser, ...globals.node} }},
  pluginJs.configs.recommended,
  {
    extends: [
      functional.configs.externalTypescriptRecommended,
      functional.configs.recommended,
      functional.configs.stylistic,
    ]
  },
  ...tseslint.configs.recommended,
];