/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@careerlaunch/domain",
    "@careerlaunch/rendering",
    "@careerlaunch/ui"
  ],
  outputFileTracingIncludes: {
    "/api/export/pdf": [
      "../../node_modules/@sparticuz/chromium/**",
      "../../node_modules/@sparticuz/chromium/bin/**",
    ],
    "/api/export/cover-letter-pdf": [
      "../../node_modules/@sparticuz/chromium/**",
      "../../node_modules/@sparticuz/chromium/bin/**",
    ],
  },
};

export default nextConfig;

