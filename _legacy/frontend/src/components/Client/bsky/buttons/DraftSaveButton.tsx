// utils
import { Dispatch, SetStateAction } from "react"

// components
import ProcButton from "../../common/ProcButton"

// service
import { saveDrafts, readDrafts } from "@/utils/useLocalStorage"
import { msgInfo } from "../../common/types"
import saveTagToSavedTags from "../lib/saveTagList"

export const Component = ({
    postText,
    setPostText,
    setDrafts,
    setMsgInfo,
    className = [],
}: {
    postText: string
    setPostText: Dispatch<SetStateAction<string>>
    setDrafts: Dispatch<SetStateAction<Array<string>>>
    setMsgInfo: Dispatch<SetStateAction<msgInfo>>
    className?: Array<string>
}) => {
    /**
     * 下書きとして保存可能かどうかを判定します
     * @returns ポスト可能な場合true
     */
    const isValidDraft = () => postText.length >= 1

    const handleSavePost = () => {
        const isValidPost = (): boolean => {
            const result: boolean = postText.length >= 1
            return result
        }

        if (!isValidPost()) {
            setMsgInfo({
                msg: "ポスト本文が存在しません。",
                isError: true,
            })
            return
        }

        saveTagToSavedTags({ postText })

        const newDrafts = [postText, ...readDrafts()]

        saveDrafts(newDrafts)
        setDrafts(newDrafts)
        setPostText("")

        setMsgInfo({
            msg: "下書きを保存しました。",
            isError: false,
        })
    }

    return (
        <ProcButton
            buttonID="post"
            handler={handleSavePost}
            isProcessing={false}
            context={
                <span className={["my-auto"].join(" ")}>下書きを保存</span>
            }
            className={["my-0", "py-0.5", "align-middle"].concat(className)}
            disabled={!isValidDraft()}
        />
    )
}
export default Component
