import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Nearly every page here reads the database or the session cookie, so we
  // use the classic dynamic-by-default rendering model instead of Cache
  // Components.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
