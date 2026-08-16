// service
import { MediaData } from "../../common/types"

export const Component = ({ mediaData }: { mediaData: MediaData }) => {
    // mediaDataがimageではない場合はコンポーネントを無効に
    if (typeof mediaData === "undefined" || mediaData.type !== "external") {
        return
    }
    const mediaDataItem = mediaData.meta
    return (
        <div
            className={[
                "rounded-2xl",
                "border-2",
                "bg-opacity-90",
                "p-2",
                "bg-white",
                "border-gray-200",
                "text-black",
                "block",
                "left-0",
                "bottom-0",
                "w-full",
                "m-0",
            ].join(" ")}
        >
            <div className={["text-left", "m-0"].join(" ")}>
                {mediaDataItem.title}
            </div>
            <div
                className={[
                    "text-left",
                    "m-0",
                    "text-xs",
                    "text-gray-600",
                ].join(" ")}
            >
                {mediaDataItem.description}
            </div>
        </div>
    )
}
export default Component
