/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  env: {
    // API base URL - akan di-set oleh docker-compose atau environment
    API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080',
  },
  // Pastikan env vars yang dimulai dengan NEXT_PUBLIC_ diekspos
  experimental: {
    appDir: true,
  },
}

export default nextConfig
