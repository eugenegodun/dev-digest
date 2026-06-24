import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Barrel-import optimization: only pull the icons/components actually used
  // from these packages' index files instead of the whole module graph.
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "react-markdown"],
  },
};

export default withNextIntl(nextConfig);
