import { ReactNode, useState } from "react"
import { button_base } from "../common/tailwindVariants"
import callPopup from "./callPopup"
import { popupOptions } from "./types"

export const Component = ({
    options,
    disabled,
    labeltext,
    clikedtext,
    className,
}: {
    options: popupOptions
    disabled: boolean
    labeltext: ReactNode
    clikedtext: ReactNode
    className?: string
}) => {
    const [clicked, setCliked] = useState<ReactNode>(<></>)
    const [color, setColor] = useState<"sky" | "blue" | "gray">("sky")
    const handleClick = () => {
        callPopup(options)
        setCliked(clikedtext)
        setColor("gray")
    }
    return (
        <>
            <button
                className={button_base({
                    disabled: disabled,
                    regectinput: disabled,
                    color: color,
                    class: className,
                })}
                onClick={handleClick}
                disabled={disabled}
            >
                {labeltext}
                {clicked}
            </button>
        </>
    )
}
export default Component
