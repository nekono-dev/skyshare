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
        indent: ["warn", 4, { SwitchCase: 1, MemberExpression: "off" }],
        quotes: ["warn", "double"],
        semi: ["warn", "never"],
        "linebreak-style": ["warn", "unix"],
        "no-irregular-whitespace": "warn",
        "prefer-const": "warn",
        "@typescript-eslint/strict-boolean-expressions": "warn",
        "@typescript-eslint/no-namespace": "warn",
        "@typescript-eslint/no-unused-vars": [
            "warn",
            { destructuredArrayIgnorePattern: "^_" },
        ],
    },
    ignorePatterns: ["dist", "node_modules"],
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
