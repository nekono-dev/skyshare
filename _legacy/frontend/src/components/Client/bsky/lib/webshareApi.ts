// utils
import { Dispatch, SetStateAction } from "react"

// service
import { type msgInfo } from "../../common/types"

const mockData = {
    text: "mocktext",
    url: "url",
    files: [new File(["dummy"], "image.png", { type: "image/png" })],
}

export const isShareEnable = ({
    setMsgInfo,
    shareData = mockData,
}: {
    setMsgInfo: Dispatch<SetStateAction<msgInfo>>
    shareData?: {
        text?: string | undefined
        url?: string | undefined
        files?: File[] | undefined
    }
}): boolean => {
    if (typeof shareData === "undefined") {
        shareData = mockData
    }
    let result: boolean = false
    if (navigator.share === undefined || navigator.canShare === undefined) {
        setMsgInfo({
            msg: "このブラウザはWebShareAPIに対応していません",
            isError: true,
        })
    } else if (navigator.canShare(shareData)) {
        result = true
    } else if (!navigator.canShare(shareData)) {
        setMsgInfo({
            msg: "このブラウザはWebShareAPIの機能に制限があるため、意図しない動作が発生する可能性があります",
            isError: true,
        })
        result = true
    } else {
        setMsgInfo({
            msg: "このブラウザはWebShareAPIに対応していません",
            isError: true,
        })
    }
    return result
}
