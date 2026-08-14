import { load_circle } from "./tailwindVariants"
const Component = ({ size }: { size: "s" | "l" | "m" }) => {
    return (
        <svg
            className={load_circle({ size: size })}
            viewBox="-10 -10 120 120"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
        >
            <path
                d="M94,50 a44,44,0,1,1,-44,-44"
                stroke="#7dd3fc"
                fill="none"
                strokeWidth={20}
                strokeLinecap="round"
            ></path>
        </svg>
    )
}
export default Component
