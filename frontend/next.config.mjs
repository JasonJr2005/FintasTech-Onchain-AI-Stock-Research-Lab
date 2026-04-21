/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hide the small "N" / Route / Turbopack floating badge that Next.js 15
  // adds to the bottom-left in dev mode. It's distracting inside the
  // FintasTech UI and adds no value for our use-case.
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/:path*",
      },
    ];
  },
};

export default nextConfig;
