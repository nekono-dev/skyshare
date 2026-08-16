import { useState, ReactNode, useEffect } from "react"
import { link } from "./tailwindVariants"

const Component = ({
    summaryLabel,
    children,
    initHidden,
}: {
    summaryLabel: string
    children: ReactNode
    initHidden: boolean
}) => {
    const [hidden, setHidden] = useState<boolean>(true)
    const onClick = () => {
        setHidden(!hidden)
    }
    useEffect(() => {
        setHidden(initHidden)
    }, [initHidden])
    return (
        <>
            <button
                className={link({ class: "block text-sm" })}
                onClick={onClick}
            >
                {summaryLabel}
                {hidden ? "▼" : "△"}
            </button>
            <div
                className={`transition-all pt-1 ${hidden ? "hidden h-0" : "h-full"}`}
            >
                {children}
            </div>
        </>
    )
}

export default Component
