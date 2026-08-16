module.exports = {
    env: {
        browser: true,
        es2021: true,
    },
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended-type-checked",
        "prettier",
    ],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        project: true,
        ecmaVersion: "latest",
        sourceType: "module",
    },
    plugins: ["@typescript-eslint", "react"],
    settings: {
        react: {
            version: "detect",
        },
    },
    rules: {
        "no-irregular-whitespace": "warn",
        "prefer-const": "warn",
        "@typescript-eslint/strict-boolean-expressions": "warn",
        "@typescript-eslint/no-namespace": "warn",
        "@typescript-eslint/no-unused-vars": [
            "warn",
            {
                args: "all",
                argsIgnorePattern: "^_",
                caughtErrors: "all",
                caughtErrorsIgnorePattern: "^_",
                destructuredArrayIgnorePattern: "^_",
                varsIgnorePattern: "^_",
                ignoreRestSiblings: true,
            },
        ],
        "@typescript-eslint/no-misused-promises": [
            "warn",
            {
                checksVoidReturn: {
                    attributes: false,
                },
            },
        ],
    },
    ignorePatterns: [
        "dist",
        "node_modules",
        "tailwind.config.mjs",
        "jest.config.cjs",
        "astro.config.mjs",
        "env.d.ts",
    ],
    overrides: [
        {
            files: ["*.{tsx, jsx}"],
            extends: ["plugin:react/recommended", "plugin:react/jsx-runtime"],
        },
        {
            files: ["*.astro"],
            parser: "astro-eslint-parser",
            parserOptions: {
                parser: "@typescript-eslint/parser",
                extraFileExtensions: [".astro"],
            },
            processor: "astro/client-side-ts",
            extends: ["plugin:astro/recommended"],
        },
        {
            files: [".eslintrc.{js,cjs}"],
            env: {
                node: true,
            },
            parserOptions: {
                sourceType: "script",
            },
            extends: ["plugin:@typescript-eslint/disable-type-checked"],
        },
        {
            files: ["tests/**/*"],
            extends: ["plugin:@typescript-eslint/disable-type-checked"],
        },
    ],
}
