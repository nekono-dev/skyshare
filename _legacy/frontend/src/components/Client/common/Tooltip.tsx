import { memo, useRef, useEffect, ReactNode } from "react"

export const Component = ({
    tooltip,
    children,
}: {
    tooltip: ReactNode
    children: ReactNode
}) => {
    const ref = useRef<HTMLDivElement>(null)

    const handleMouseEnter = () => {
        if (!ref.current) return
        ref.current.style.opacity = "1"
        ref.current.style.visibility = "visible"
    }

    const handleMouseLeave = () => {
        if (!ref.current) return
        ref.current.style.opacity = "0"
        ref.current.style.visibility = "hidden"
    }
    useEffect(() => {
        handleMouseLeave()
    }, [])
    return (
        <div className="relative">
            <div
                className="absolute top-full p-2 rounded-lg bg-white w-full md:max-w-2xl mx-auto left-0 right-0"
                ref={ref}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {tooltip}
            </div>
            <div
                className="w-fit h-fit m-auto"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {children}
            </div>
        </div>
    )
}

const memoTooltip = memo(Component)
export default memoTooltip
