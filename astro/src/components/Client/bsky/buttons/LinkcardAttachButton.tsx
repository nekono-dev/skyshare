// utils
import { Dispatch, SetStateAction, useEffect, useState } from "react"

// components
import ProcButton from "../../common/ProcButton"

// backend api
import { getOgpMeta, getOgpBlob } from "@/lib/getOgp"

// service
import { richTextFacetParser } from "@/utils/richTextParser"
import { msgInfo, MediaData } from "../../common/types"

const handleGetOGP = async ({
    postText,
    setProcessing,
    setMsgInfo,
    siteurl,
    setMediaData,
}: {
    postText: string
    setProcessing: Dispatch<SetStateAction<boolean>>
    setMsgInfo: Dispatch<SetStateAction<msgInfo>>
    siteurl: string
    setMediaData: Dispatch<SetStateAction<MediaData | null>>
}) => {
    const linkUrl = getLinkFromPostText({ postText })
    if (linkUrl === null) return
    setProcessing(true)
    setMsgInfo({
        isError: false,
        msg: "リンクカードを取得中...",
    })
    try {
        let blob: Blob | null = null
        const ogpMeta = await getOgpMeta({
            siteurl,
            externalUrl: linkUrl,
            languageCode: "ja",
        })
        if (ogpMeta.type === "error") {
            const e: Error = new Error(ogpMeta.message)
            e.name = ogpMeta.error
            throw e
        }
        // titleが存在しない場合は、暫定的にTitleをURLにする
        if (ogpMeta.title === "") {
            ogpMeta.title = linkUrl
        }
        if (ogpMeta.image !== "") {
            blob = await getOgpBlob({
                siteurl,
                externalUrl: ogpMeta.image,
                languageCode: "ja",
            })
        }
        setMediaData({
            type: "external",
            meta: {
                ...ogpMeta,
                url: linkUrl,
            },
            images: [
                {
                    blob,
                },
            ],
        })
        setMsgInfo({
            isError: false,
            msg: "リンクカードを取得しました！",
        })
    } catch (e: unknown) {
        if (e instanceof Error) {
            setMsgInfo({
                isError: true,
                msg: `${e.name}: ${e.message}`,
            })
        }
        //リンクカード設定を解除
        setMediaData(null)
    }
    setProcessing(false)
}

const getLinkFromPostText = ({
    postText,
}: {
    postText: string
}): string | null => {
    const richTextLinkParser = new richTextFacetParser("link")
    const parseResult = richTextLinkParser.getFacet(postText)
    if (parseResult.length < 1) {
        return null
    } else {
        // 貼られた最後のlinkからOGPを取得する
        // いずれは任意のURLを選べるようにしたい
        return parseResult[parseResult.length - 1]
    }
}

export const Component = ({
    postText,
    setMediaData,
    isProcessing,
    setProcessing,
    setMsgInfo,
    siteurl,
}: {
    postText: string
    setMediaData: Dispatch<SetStateAction<MediaData | null>>
    isProcessing: boolean
    setProcessing: Dispatch<SetStateAction<boolean>>
    setMsgInfo: Dispatch<SetStateAction<msgInfo>>
    siteurl: string
}) => {
    const linkMaxLength = 50
    const [linkUrl, setLinkUrl] = useState<string | null>(null)
    useEffect(() => {
        setLinkUrl(getLinkFromPostText({ postText }))
    }, [postText])
    return (
        <ProcButton
            buttonID="linkcardattach"
            handler={() =>
                handleGetOGP({
                    postText,
                    setProcessing,
                    setMsgInfo,
                    siteurl,
                    setMediaData,
                })
            }
            isProcessing={isProcessing}
            context={
                <>
                    <span className="m-0">リンクカードを追加</span>
                    {linkUrl !== null && (
                        <div className="text-xs m-0">
                            {`${new URL(linkUrl).href.slice(0, linkMaxLength)}${
                                linkUrl.length > linkMaxLength ? "..." : ""
                            }`}
                        </div>
                    )}
                </>
            }
            className={["mx-1", "w-full", "mb-1"]}
            disabled={linkUrl === null}
        />
    )
}
export default Component
export { handleGetOGP }
