import { defineConfig } from "orval"

export default defineConfig({
    api: {
        input: "./openapi/index.yaml", // or openapi.json
        output: {
            target: "./src/client/openapi/client.ts",
            schemas: "./src/client/openapi/model",
            client: "fetch",
            mode: "single",
            clean: true,
        },
    },
})
