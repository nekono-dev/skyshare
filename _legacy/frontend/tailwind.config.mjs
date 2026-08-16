const plugin = require("tailwindcss/plugin")

/** @type {import('tailwindcss').Config} */
export default {
    content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
    theme: {
        extend: {},
    },
    plugins: [
        plugin(function ({ addBase, theme, addUtilities }) {
            addBase({
                h1: {
                    fontSize: theme("fontSize.4xl"),
                    "@media (min-width: 768px)": {
                        fontSize: theme("fontSize.5xl"),
                    },
                    fontWeight: theme("fontWeight.medium"),
                    marginBottom: "1rem",
                },
                h2: {
                    fontSize: theme("fontSize.2xl"),
                    "@media (min-width: 768px)": {
                        fontSize: theme("fontSize.3xl"),
                    },
                    fontWeight: theme("fontWeight.medium"),
                    marginBottom: "0.5rem",
                    marginTop: "0.5rem",
                },
                h3: {
                    fontSize: theme("fontSize.xl"),
                    "@media (min-width: 768px)": {
                        fontSize: theme("fontSize.2xl"),
                    },
                    marginBottom: "0.5rem",
                    marginTop: "0.5rem",
                },
                h4: {
                    fontSize: theme("fontSize.lg"),
                    "@media (min-width: 768px)": {
                        fontSize: theme("fontSize.xl"),
                    },
                    marginBottom: "0.5rem",
                    marginTop: "0.5rem",
                },
                ul: {
                    listStyleType: theme("listStyleType.disc"),
                    marginLeft: "1.1rem",
                    marginBottom: "0rem",
                },
                a: {
                    color: "rgb(56 189 248)", // text-sky-400
                    fontWeight: theme("fontWeight.medium"),
                },
                "a:hover": {
                    color: "rgb(37 99 235)", // text-blue-600
                },
                code: {
                    backgroundColor: "rgb(226 232 240);", // bg-gray-200
                    borderRadius: theme("borderRadius.md"),
                    paddingLeft: "0.3rem",
                    paddingRight: "0.3rem",
                    fontSize: theme("fontSize.sm"),
                    fontFamily: theme("font-mono"),
                    color: "black",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                },
                s: {
                    color: "rgb(156 163 175)", // text-gray-400
                },
                pre: {
                    backgroundColor: "rgb(226 232 240);", // bg-gray-200
                    paddingTop: "0.5rem",
                    paddingBottom: "0.5rem",
                    paddingRight: "2rem",
                    paddingLeft: "2rem",
                    margin: "0.5rem",
                    borderRadius: theme("borderRadius.md"),
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                },
            })
            const newUtilities = {
                ".minimum-scrollbars": {
                    scrollbarWidth: "none",
                    "&::-webkit-scrollbar": {
                        width: "0px",
                        background: "transparent",
                        display: "none",
                    },
                    "& *::-webkit-scrollbar": {
                        width: "0px",
                        background: "transparent",
                        display: "none",
                    },
                    "& *": {
                        scrollbarWidth: "none",
                    },
                },
            }
            addUtilities(newUtilities)
        }),
        // ...
    ],
}
