import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // A stray C:\Users\lkspe\package-lock.json makes Next.js infer the wrong
    // workspace root — pin it explicitly to this project.
    root: path.join(__dirname),
  },
};

export default nextConfig;
