/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@careerlaunch/domain",
    "@careerlaunch/rendering",
    "@careerlaunch/ui"
  ]
};

export default nextConfig;

