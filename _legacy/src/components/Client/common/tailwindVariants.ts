import { tv } from "tailwind-variants"

export const link = tv({
    base: "text-sky-500 hover:text-red-300",
    variants: {
        enabled: {
            true: "",
            false: "text-gray-600 hover:text-gray-600",
        },
    },
})

export const inputtext_base = tv({
    base: "my-1 focus:outline-none text-lg md:text-base",
    variants: {
        kind: {
            outbound: "border-2 rounded-md bg-white",
            inbound: "m-0 px-3 py-1",
        },
        disabled: {
            true: "bg-gray-200 text-gray-600",
            false: "",
        },
        onDragEnter: {
            true: "border-blue-400 border-2 border-dashed cursor-pointer",
            false: "",
        },
    },
})

export const button_base = tv({
    base: "border-2 rounded-full px-6 py-1 mx-px font-medium sm:font-normal bg-white hover:bg-gray-200 text-black",
    variants: {
        color: {
            blue: "bg-blue-500 hover:bg-blue-700 text-white",
            sky: "bg-sky-400 hover:bg-sky-600 text-white",
            gray: "bg-gray-400 hover:bg-gray-600 text-white",
        },
        disabled: {
            false: "cursor-pointer transition-all",
            true: "hover:bg-gray-200 bg-gray-200 cursor-progress text-gray-700 hover:text-gray-700",
        },
        regectinput: {
            true: "cursor-not-allowed",
            false: "",
        },
        hidden: {
            true: "hidden",
            false: "",
        },
        noshadow: {
            false: "shadow",
            true: "shadow-none",
        },
    },
})

export const load_circle = tv({
    base: ["inline-block", "animate-spin"],
    variants: {
        size: {
            s: "h-[20px] w-[20px]",
            l: "h-24 w-24",
            m: "h-16 w-16",
        },
    },
})
