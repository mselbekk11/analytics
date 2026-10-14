import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // convex-test needs the edge runtime; pure helpers run fine in it too
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
  },
  resolve: {
    tsconfigPaths: true,
  },
});
