/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: process.env.NODE_ENV === 'production',
};

export default nextConfig;
