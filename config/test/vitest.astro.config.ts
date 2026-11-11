/**
 * Vitest configuration for server-rendering `.astro` pages.
 *
 * The Cloudflare adapter cannot run in Vitest, so use Astro's Vite config without loading
 * `astro.config.mjs`; React is the only integration required for these renders.
 */
import react from "@astrojs/react"
import { getViteConfig } from "astro/config"
import path from "node:path"

export default getViteConfig(
    {
        resolve: {
            alias: { "@": path.resolve(import.meta.dirname, "../../src") },
        },
        test: {
            environment: "node",
            include: ["tests/render/**/*.test.ts"],
        },
    } as never,
    {
        configFile: false,
        site: "https://skyshare.nekono.dev",
        trailingSlash: "always",
        integrations: [react()],
    } as never,
)
