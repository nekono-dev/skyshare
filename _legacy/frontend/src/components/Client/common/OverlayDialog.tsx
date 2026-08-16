// utils
import { KeyboardEvent, useRef, ReactNode } from "react"

/**
 * Dialogの共通コンポーネント
 * @param callbackOpenDialog ダイアログをオープンする前に実行される関数
 * @param callbackCloseDialog ダイアログをクローズした後に実行される関数
 * @param buttonOption.className ダイアログをひらくボタンのクラス設定
 * @param buttonOption.content ダイアログを開くボタンの内容
 * @param children ダイアログの内容
 */
export const Component = ({
    callbackOpenDialog,
    callbackCloseDialog,
    buttonOption,
    children,
}: {
    callbackOpenDialog?: () => void
    callbackCloseDialog?: () => void
    buttonOption: {
        className: string
        content: ReactNode
    }
    children: ReactNode
}) => {
    const ref = useRef<HTMLDialogElement | null>(null)

    const handleOpenDialog = () => {
        typeof callbackOpenDialog !== "undefined" && callbackOpenDialog()
        if (ref.current) {
            ref.current.showModal()
        }
    }

    const handleCloseDialog = () => {
        if (ref.current) {
            ref.current.close()
        }
        typeof callbackCloseDialog !== "undefined" && callbackCloseDialog()
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
        if (event.key === "Escape") {
            handleCloseDialog()
        }
    }

    return (
        <>
            <button
                onClick={handleOpenDialog}
                className={buttonOption.className}
            >
                {buttonOption.content}
            </button>
            <dialog
                ref={ref}
                className="p-10 rounded-2xl"
                onClick={handleCloseDialog}
                onKeyDown={handleKeyDown}
            >
                {children}
            </dialog>
        </>
    )
}
export default Component
