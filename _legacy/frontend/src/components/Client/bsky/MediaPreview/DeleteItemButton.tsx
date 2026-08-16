// utils
import { Dispatch, SetStateAction } from "react"

// service
import { MediaData } from "../../common/types"

const Component = ({
    itemId,
    mediaData,
    setMediaData,
}: {
    itemId: number
    mediaData: MediaData
    setMediaData: Dispatch<SetStateAction<MediaData>>
}) => {
    const handleClick = () => {
        if (itemId < 0 || itemId > 3) {
            return
        }
        if (typeof mediaData === "undefined") {
            return
        }
        if (mediaData.type === "external") {
            // linkcardは1枚なので消した時点でlistは空
            setMediaData(undefined)
            return
        }
        if (mediaData.type === "images") {
            if (mediaData.images.length < 0) {
                return
            }
            // Listから自身のitemIdを取り除き、これをリストに追加する
            const imagesResult = mediaData.images.filter(
                (_, index) => index !== itemId,
            )
            const filesResult = mediaData.files.filter(
                (_, index) => index !== itemId,
            )
            // 全てのメディアが削除された場合は null とする
            if (imagesResult.length <= 0) {
                setMediaData(undefined)
                return
            }
            setMediaData({
                type: mediaData.type,
                images: imagesResult,
                files: filesResult,
            })
        }
    }
    return (
        <>
            <button
                onClick={handleClick}
                className={[
                    "rounded-full",
                    "h-8",
                    "w-8",
                    "border-2",
                    "bg-white",
                    "border-gray-700",
                    "absolute",
                    "left-1",
                    "top-1",
                ].join(" ")}
            >
                ✖️
            </button>
        </>
    )
}
export default Component
