import next from "eslint-config-next";

const config = [
  ...next,
  { ignores: [".next/**", "node_modules/**", ".data/**", "demo/**", "next-env.d.ts"] },
];

export default config;
