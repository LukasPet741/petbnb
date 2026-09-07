import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // A stray C:\Users\lkspe\package-lock.json makes Next.js infer the wrong
    // workspace root — pin it explicitly to this project.
    root: path.join(__dirname),
  },
  async redirects() {
    return [
      // /terms was the single legal page before the documents were split into
      // /legal/{terms,privacy}. Redirects are checked ahead of the filesystem,
      // so bookmarks and anything already linking to the old path still land.
      { source: "/terms", destination: "/legal/terms", permanent: true },
    ];
  },
};

export default nextConfig;
