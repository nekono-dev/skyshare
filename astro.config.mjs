// @ts-check
import { defineConfig } from "astro/config"
import cloudflare from "@astrojs/cloudflare"

import react from "@astrojs/react";

export default defineConfig({
  output: "server",
  adapter: cloudflare(),

  server: {
    port: 4321,
    host: true,
  },

  integrations: [react()],
})