import { Dispatch, SetStateAction, useState, useEffect } from "react"
import { type modes } from "./types"
import ProcButton from "./ProcButton"

const Component = ({
    mode,
    setMode,
    isProcessing,
}: {
    isProcessing: boolean
    mode: modes
    setMode: Dispatch<SetStateAction<modes>>
}) => {
    const [label, setLabel] = useState<string>("")
    const swichLabel = () => {
        switch (mode) {
            // case "bsky":
            //     setLabel("OGPページ一覧")
            //     break
            case "pagedb":
                setLabel("投稿画面へ戻る")
                break
            case "xcom":
                setLabel("投稿画面へ戻る")
                break
        }
    }
    const handleClick = () => {
        switch (mode) {
            // case "bsky":
            //     setMode("pagedb")
            //     break
            case "pagedb":
                setMode("bsky")
                break
            case "xcom":
                setMode("bsky")
                break
        }
    }

    useEffect(() => {
        swichLabel()
    }, [mode])

    return (
        <ProcButton
            handler={handleClick}
            isProcessing={false}
            context={label}
            showAnimation={false}
            disabled={isProcessing}
        />
    )
}
export default Component
