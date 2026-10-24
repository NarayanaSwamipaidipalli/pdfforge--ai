/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: process.env.API_GATEWAY_INTERNAL_URL || 'http://api-gateway:4000/api/v1/:path*',
      },
    ];
  },
};

export default nextConfig;
