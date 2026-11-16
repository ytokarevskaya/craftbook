import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Projekt má vlastní AGENTS.md; vývojový server jej nemá upravovat.
  agentRules: false,
};

export default nextConfig;
