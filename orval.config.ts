import { defineConfig } from "orval"

export default defineConfig({
    api: {
        input: {
            parserOptions: {
                externalRefs: {
                    allow: ["*"],
                },
            },
            target: "./openapi/index.yaml",
        },
        output: {
            target: "./src/client/openapi/client.ts",
            schemas: "./src/client/openapi/model",
            client: "fetch",
            mode: "single",
            clean: true,
            override: {
                formData: {
                    mutator: {
                        path: "./src/lib/codegen/openapiFormData.ts",
                        name: "customFormData",
                    },
                },
                mutator: {
                    path: "./src/lib/codegen/fetcher.ts",
                    name: "customFetcher",
                },
            },
        },
    },
})
