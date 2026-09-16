import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Cloudflare build output and local Workers state. These are generated
      // bundles containing vendored third-party code; linting them produced
      // 8,200 problems from libraries nobody here wrote.
      ".open-next/**",
      ".wrangler/**",
      // Generated: a byte-for-byte mirror of migrations/*.sql and seeds/*.sql.
      "src/lib/schema/sql.generated.ts",
    ],
  },
];

export default eslintConfig;
