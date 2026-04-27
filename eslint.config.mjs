import next from "eslint-config-next";

const eslintConfig = [
  {
    ignores: [".next/**", ".tools/**", "node_modules/**"],
  },
  ...next,
];

export default eslintConfig;
