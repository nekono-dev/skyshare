// utils
import React, { useRef, Dispatch, SetStateAction } from "react"

// components
import ProcButton from "../../common/ProcButton"

// service
import { imageExtensions, addImageMediaData } from "../lib/addImageMediaData"
import { MediaData } from "../../common/types"

// resources
import pic from "@/images/image.svg"

const Component = ({
    disabled,
    mediaData,
    setMediaData,
}: {
    disabled: boolean
    mediaData: MediaData
    setMediaData: Dispatch<SetStateAction<MediaData>>
}) => {
    const inputRef = useRef<HTMLInputElement>(null!)
    const handleClick = () => {
        inputRef.current.click()
    }

    /**
     * ファイル選択時の処理を行います
     * @param event チェンジイベント
     * @returns なし
     */
    const handleFilechanged = (event: React.ChangeEvent<HTMLInputElement>) => {
        const inputFiles: FileList | null = event.currentTarget.files
        // 入力されたファイルがない場合は処理を中断
        if (!inputFiles || inputFiles?.length === 0) {
            event.target.value = ""
            return
        }
        addImageMediaData(Array.from(inputFiles), mediaData, setMediaData)
        event.target.value = ""
    }

    const acceptlist = imageExtensions.join(",")
    return (
        <>
            <input
                type="file"
                accept={acceptlist}
                ref={inputRef}
                style={{ display: "none" }}
                onChange={handleFilechanged}
                multiple
            />
            <ProcButton
                handler={handleClick}
                isProcessing={disabled}
                className={["py-0"]}
                context={
                    <img
                        src={pic.src}
                        className={[
                            "w-7",
                            "h-7",
                            "p-0.5",
                            "inline-block",
                            "align-middle",
                        ].join(" ")}
                    />
                }
                showAnimation={false}
            />
        </>
    )
}

export default Component
