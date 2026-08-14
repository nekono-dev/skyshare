// utils
import React, { memo, useRef, useCallback, useState, useEffect } from "react"

// component
import OverlayDialog from "../../common/OverlayDialog"

// service
import { inputtext_base, link } from "../../common/tailwindVariants"
import { MediaData } from "../../common/types"

const Img = ({
    mediaDataItem,
}: {
    mediaDataItem: {
        alt: string
        blob: Blob
    }
}) => {
    return (
        <img
            src={URL.createObjectURL(mediaDataItem.blob)}
            className="max-w-md w-full mx-auto"
        />
    )
}
const MemoImg = memo(Img)

export const Component = ({
    itemId,
    mediaData,
}: {
    itemId: number
    mediaData: MediaData
}) => {
    // mediaDataがimageではない場合はコンポーネントを無効に
    if (typeof mediaData === "undefined" || mediaData.type !== "images") {
        return
    }
    let mediaDataItem = mediaData.images[itemId]
    const textref = useRef<HTMLTextAreaElement | null>(null)
    const [altBoxText, setAltBoxText] = useState<string>(mediaDataItem.alt)
    const maxShowAltLength = 10

    const handleOpenDialog = () => {
        if (textref.current) {
            textref.current.value = mediaDataItem.alt
        }
    }

    const handleCloseDialog = () => {
        mediaDataItem.alt = altBoxText
    }

    const handleClickInDialog = useCallback(
        (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
            e.stopPropagation()
        },
        [],
    )

    const handleOnChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        // メディアがimagesの場合のみ処理
        if (mediaData === null || mediaData.type !== "images") {
            return
        }
        setAltBoxText(event.target.value)
        mediaDataItem.alt = event.target.value
    }

    const handleClick = () => {
        setAltBoxText("")
        mediaDataItem.alt = ""
        if (textref.current) {
            textref.current.value = ""
        }
    }

    useEffect(() => {
        // データが更新されたらAltを更新
        mediaDataItem = mediaData.images[itemId]
        setAltBoxText(mediaData.images[itemId].alt)
    }, [mediaData.images])
    return (
        <OverlayDialog
            callbackOpenDialog={handleOpenDialog}
            callbackCloseDialog={handleCloseDialog}
            buttonOption={{
                className:
                    [
                        "rounded-lg",
                        "border-1",
                        "bg-opacity-70",
                        "px-2",
                        "bg-black",
                        "border-white",
                        "text-white",
                        "absolute",
                        "left-1",
                        "bottom-1",
                    ].join(" ") + (altBoxText !== "" ? " bg-blue-500" : ""),
                content:
                    altBoxText !== ""
                        ? `${altBoxText.slice(0, maxShowAltLength)}${
                              altBoxText.length >= maxShowAltLength ? "..." : ""
                          }`
                        : "Altを設定",
            }}
        >
            <div onClick={handleClickInDialog}>
                <MemoImg mediaDataItem={mediaDataItem} />
                <label>
                    画像に設定するAltを入力（ダイアログを閉じると反映）
                </label>
                <textarea
                    onChange={handleOnChange}
                    autoFocus={true}
                    ref={textref}
                    placeholder="上記に設定するAltを入力してください"
                    className={inputtext_base({
                        kind: "outbound",
                        class: "p-4 w-full md:w-lg resize-y overflow-y-auto h-32",
                    })}
                />
                <button
                    className={link({ enabled: !(altBoxText === "") })}
                    disabled={altBoxText === ""}
                    onClick={handleClick}
                >
                    内容をクリア
                </button>
            </div>
        </OverlayDialog>
    )
}
export default Component
