import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: [
      "convex/_generated/**",
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
