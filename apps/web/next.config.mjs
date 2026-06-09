const imageBaseUrl = process.env.NEXT_PUBLIC_HOTSITE_IMAGE_BASE_URL ?? 'http://localhost:4443';
const imageHostname = new URL(imageBaseUrl).hostname;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ hostname: imageHostname }],
  },
};

export default nextConfig;
