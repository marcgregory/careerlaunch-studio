// eslint-config-next is a CJS module — use createRequire for ESM compat
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const nextConfig = require("eslint-config-next");

const config = [...nextConfig];

export default config;
