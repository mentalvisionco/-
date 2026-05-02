/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'out',
  eslint: {
    // Ignore ESLint errors during deployment to prevent build failures
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
