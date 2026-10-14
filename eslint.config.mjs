import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const config = [...nextVitals, ...nextTypeScript, {
  // CommonJS maintenance scripts use Node's require syntax intentionally.
  files: ["**/*.cjs"],
  rules: { "@typescript-eslint/no-require-imports": "off" },
}];
export default config;
