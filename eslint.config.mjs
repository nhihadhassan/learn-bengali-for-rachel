import next from "eslint-config-next";

const eslintConfig = [
  {
    // Ignore generated output wherever it appears, including nested worktrees.
    ignores: ["**/.next/**", "**/.tools/**", "**/node_modules/**"],
  },
  ...next,
];

export default eslintConfig;
