import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: [
      ".next/**",
      ".next-rpc-test/**",
      ".next-webpack/**",
      "coverage/**",
      "node_modules/**",
    ],
  },
  ...nextVitals,
];

export default config;
