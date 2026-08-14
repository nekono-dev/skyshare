import Loadingcircle from "./LoadingCircle"
import { buttonID } from "../bsky/types"
import { clickedButtonContext } from "./contexts"
import { button_base } from "./tailwindVariants"
import { ReactNode, useContext } from "react"

const Component = ({
    handler,
    buttonID,
    isProcessing,
    context,
    showAnimation = true,
    className,
    disabled = false,
    color,
    hidden,
}: {
    handler: () => void
    buttonID?: buttonID
    isProcessing: boolean
    context: ReactNode
    showAnimation?: boolean
    className?: Array<string>
    disabled?: boolean
    hidden?: boolean
    color?: "blue"
}) => {
    const { clickedButtonID, setClickedButtonID } =
        useContext(clickedButtonContext)
    const handlerWrapper = (callback: () => void) => {
        callback()
        const thisButtonID = typeof buttonID !== "undefined" ? buttonID : ""
        setClickedButtonID(thisButtonID)
    }
    const Animation =
        clickedButtonID !== "" && clickedButtonID === buttonID && showAnimation
    return (
        <button
            onClick={() => handlerWrapper(handler)}
            className={button_base({
                disabled: isProcessing || disabled,
                regectinput: disabled,
                class: className,
                color: color,
                hidden: hidden,
                noshadow: disabled,
            })}
            type="button"
            disabled={isProcessing || disabled}
        >
            {isProcessing ? (
                Animation ? (
                    <span
                        className={[
                            "flex",
                            "items-center",
                            "w-fit",
                            "mx-auto",
                        ].join(" ")}
                    >
                        <Loadingcircle size="s" />
                    </span>
                ) : (
                    <>{context}</>
                )
            ) : (
                <>{context}</>
            )}
        </button>
    )
}
export default Component
