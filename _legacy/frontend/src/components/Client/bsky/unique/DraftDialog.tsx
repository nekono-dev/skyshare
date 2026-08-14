// utils
import { Dispatch, SetStateAction, useEffect } from "react"

// component
import OverlayDialog from "../../common/OverlayDialog"

// service
import { readDrafts, saveDrafts } from "@/utils/useLocalStorage"

export const Component = ({
    setPostText,
    drafts,
    setDrafts,
}: {
    setPostText: Dispatch<SetStateAction<string>>
    drafts: Array<string>
    setDrafts: Dispatch<SetStateAction<Array<string>>>
}) => {
    useEffect(() => {
        setDrafts(readDrafts())
    }, [])

    /**
     * 下書きのリストから index 番目を削除します
     * @param index 削除する下書きの index
     */
    const handleDeleteDraft = (index: number) => {
        if (drafts.length <= 0) {
            return
        }

        const newDrafts = [...drafts]
        newDrafts.splice(index, 1)

        setDrafts(newDrafts)
        saveDrafts(newDrafts)
    }

    /**
     * 下書きを適用し、リストから削除します
     * @param draft 適用する下書き
     * @param index 下書きの index
     */
    const handleClickDraft = (draft: string, index: number) => {
        if (drafts.length <= 0) {
            return
        }
        setPostText(draft)

        const newDrafts = [...drafts]
        newDrafts.splice(index, 1)

        setDrafts(newDrafts)
        saveDrafts(newDrafts)
    }

    return (
        <OverlayDialog
            buttonOption={{
                content: "下書き一覧",
                className: ["mr-2"].join(" "),
            }}
        >
            <div
                className={[
                    "text-left",
                    "overflow-auto",
                    "max-h-dvh",
                    "px-2",
                    "m-0",
                    "sm:min-w-96",
                    "sm:max-w-screen-sm",
                    "min-w-48",
                    "max-w-full",
                ].join(" ")}
            >
                <div className="border-gray-200 border-b-2">下書き一覧</div>
                {drafts.length > 0 ? (
                    drafts.map((draft, index) => (
                        <div
                            key={`draft-${draft}`}
                            className={
                                ["flex", "mb-0", "items-center", "py-4"].join(
                                    " ",
                                ) +
                                ` ${index !== drafts.length - 1 ? "border-b border-gray-200" : ""}`
                            }
                        >
                            <div
                                className={[
                                    "flex-1",
                                    "cursor-pointer",
                                    "line-clamp-1",
                                    "pr-4",
                                    "break-all",
                                    "mb-0",
                                ].join(" ")}
                                onClick={() => {
                                    handleClickDraft(draft, index)
                                }}
                            >
                                {draft.trim()}
                            </div>
                            <button
                                className={[
                                    "px-2 py-1",
                                    "bg-red-500",
                                    "text-white",
                                    "rounded",
                                    "hover:bg-red-600",
                                    "focus:outline-none",
                                    "focus:ring-2",
                                    "focus:ring-red-500",
                                    "focus:ring-opacity-50",
                                ].join(" ")}
                                onClick={() => {
                                    handleDeleteDraft(index)
                                }}
                            >
                                削除
                            </button>
                        </div>
                    ))
                ) : (
                    <div>下書きがありません</div>
                )}
            </div>
        </OverlayDialog>
    )
}
export default Component
