// utils
import { useContext, Dispatch, SetStateAction } from "react"
import { useKey } from "react-use"
import type { KeyPredicate } from "react-use/lib/useKey"

// components
import { Session_context } from "../../common/contexts"
import ProcButton from "../../common/ProcButton"

// atproto
import { label } from "@/utils/atproto_api/labels"
import detectFacets from "@/utils/atproto_api/detectFacets"
import createRecord from "@/utils/atproto_api/createRecord"
import type record from "@/utils/atproto_api/record"
import uploadBlob from "@/utils/atproto_api/uploadBlob"
import type {
    uploadBlobSuccessResult,
    uploadBlobResult,
} from "@/utils/atproto_api/uploadBlob"
import resolveHandle, {
    type resolveHandleResult,
} from "@/utils/atproto_api/resolveHandle"

// backend api
import createPage from "@/lib/pagedbAPI/createPage"
import browserImageCompression from "@/utils/browserImageCompression"
import { getOgpBlob, getOgpMeta } from "@/lib/getOgp"

// service
import { callbackPostOptions } from "../PostForm"
import { msgInfo, MediaData } from "../../common/types"
import { servicename } from "@/env/vars"
import { pagesPrefix } from "@/env/envs"
import saveTagToSavedTags from "../lib/saveTagList"
import { richTextFacetParser } from "@/utils/richTextParser"
import { bskyProfileURL } from "@/env/bsky"
import { isShareEnable } from "../lib/webshareApi"

const sleep = (msec: number) =>
    new Promise(resolve => setTimeout(resolve, msec))

export const Component = ({
    postText,
    language,
    selfLabel,
    options,
    mediaData,
    callback,
    isProcessing,
    setProcessing,
    setMsgInfo,
    disabled,
    userAgent,
}: {
    postText: string
    language: string
    selfLabel: label.value | null
    options: {
        appendVia: boolean
        noGenerateOgp: boolean
        useWebAPI: boolean
        // autoPopup: boolean
    }
    mediaData: MediaData
    callback: (options: callbackPostOptions) => void
    isProcessing: boolean
    setProcessing: Dispatch<SetStateAction<boolean>>
    setMsgInfo: Dispatch<SetStateAction<msgInfo>>
    disabled: boolean
    userAgent: string
}) => {
    // 配置されたサイトのURL
    const siteurl = location.origin
    // セッション
    const { session } = useContext(Session_context)
    /** Apple製品利用者の可能性がある場合True */
    const isAssumedAsAppleProdUser = userAgent.includes("mac os x")

    // 画像の幅・高さを取得するユーティリティ
    const getImageSize = (blob: Blob): Promise<{ width: number; height: number }> =>
        new Promise((resolve, reject) => {
            const url = URL.createObjectURL(blob)
            const img = new Image()
            img.onload = () => {
                resolve({ width: img.naturalWidth, height: img.naturalHeight })
                URL.revokeObjectURL(url)
            }
            img.onerror = (e) => {
                URL.revokeObjectURL(url)
                reject(e)
            }
            img.src = url
        })

    const handlePost = async () => {
        const isValidPost = (): boolean => {
            let result: boolean = postText.length >= 1
            if (typeof mediaData !== "undefined") {
                result = result || mediaData.images.length > 0
            }
            return result
        }

        if (!isValidPost()) {
            setMsgInfo({
                msg: "ポスト本文が存在しないか、メディアが添付されていません。",
                isError: true,
            })
            return
        }

        const initializePost = () => {
            setProcessing(true)
            // Postを押したら強制的にフォーカスアウトイベントを発火
        }
        initializePost()
        try {
            // プレビューへ送るテキストを別途初期化
            const callbackPostOptions: callbackPostOptions = {
                externalPostText: postText,
                previewTitle: undefined,
                previewData: undefined,
                isNeedChangeMode: true,
            }
            // WebShareAPI対応
            if (options.useWebAPI) {
                const url =
                    mediaData?.type === "external"
                        ? mediaData.meta.url
                        : undefined
                const files =
                    mediaData?.type === "images" ? mediaData.files : undefined

                const shareData = {
                    text: callbackPostOptions.externalPostText,
                    url: url,
                    files: files,
                }
                if (isShareEnable({ setMsgInfo, shareData })) {
                    try {
                        // 暫定対処: 本文をクリップボードにコピーする、コピー例外はスルーする
                        navigator.clipboard
                            .writeText(shareData.text)
                            .then(() => {
                                setMsgInfo({
                                    msg: "本文をクリップボードにコピーしました",
                                    isError: false,
                                })
                            })
                            .catch(() => {
                                setMsgInfo({
                                    msg: "クリップボードへの本文コピーに失敗しました",
                                    isError: true,
                                })
                            })
                        await sleep(1000)
                        await navigator.share(shareData).then(() => {
                            setMsgInfo({
                                msg: "共有が完了しました!",
                                isError: false,
                            })
                            callbackPostOptions.isNeedChangeMode = false
                        })
                    } catch (e: unknown) {
                        let msg = "Unexpected Unknown Error"
                        let isError: boolean = false
                        if (e instanceof Error) {
                            if (e.name === "AbortError") {
                                msg =
                                    "共有が中断されたため、投稿をキャンセルしました"
                                // // WebShareAPIをSafariで動かす場合、HTTPSのホストでしか利用できない成約がある
                                // } else if (e.name === "NotAllowedError") {
                                //     msg = "On Safari, localhost not allowed to use WebShareAPI with media attached."
                            } else {
                                msg = e.name + ": " + e.message
                                isError = true
                            }
                        }
                        setMsgInfo({
                            msg: msg,
                            isError: isError,
                        })
                        setProcessing(false)
                        return
                    }
                }
            }
            setMsgInfo({
                msg: "レコードを作成中...",
                isError: false,
            })
            // facetを取得
            const facets = await detectFacets({ text: postText })
            // 今後公式APIを使うことを考慮し、recordBuilder.tsの利用を終了
            let Record: record = {
                text: postText,
                createdAt: new Date(),
                langs: [language],
                $type: "app.bsky.feed.post",
                labels:
                    selfLabel !== null
                        ? {
                              $type: "com.atproto.label.defs#selfLabels",
                              values: [selfLabel],
                          }
                        : undefined,
                via: options.appendVia !== false ? servicename : undefined,
                facets: facets.length > 0 ? facets : undefined,
            }

            // ポストにタグが含まれる場合は保存
            saveTagToSavedTags({ postText })

            // 投稿の文字制限を解除（API側に処理させる）
            // また、ツリー投稿機能の実装の際は分割方法を検討すること

            // intent投稿側の表示をURLにする機能の実装
            // mentionを検出
            const richTextLinkParser = new richTextFacetParser("mention")
            const parseResult = richTextLinkParser.getFacet(postText)

            // facetを参照せず、再度取得
            const resolveHandleTasks: Array<Promise<resolveHandleResult>> = []
            parseResult.forEach(value => {
                const mentionHandle = value
                resolveHandleTasks.push(
                    resolveHandle({
                        handle: mentionHandle.slice(1),
                    }),
                )
            })
            const resultResolveHandle = await Promise.allSettled(
                resolveHandleTasks,
            ).then(values => {
                const result: Array<resolveHandleResult | null> = []
                values.forEach(value => {
                    if (value.status !== "rejected") {
                        result.push(value.value)
                        value.value
                    } else {
                        result.push(null)
                    }
                })
                return result
            })
            // didが取得できた項目に関して置き換え処理
            resultResolveHandle.forEach((value, index) => {
                const mentionHandle = parseResult[index]
                const callbackPostText = callbackPostOptions.externalPostText
                if (value !== null) {
                    callbackPostOptions.externalPostText =
                        callbackPostText.replace(
                            mentionHandle,
                            new URL(
                                mentionHandle.slice(1),
                                bskyProfileURL,
                            ).toString(),
                        )
                }
            })

            const ImageAttached =
                typeof mediaData !== "undefined" &&
                mediaData.images.length > 0 &&
                mediaData.images[0].blob !== null

            // メディアデータが存在する場合はRecordに対して特定の処理を行う
            if (ImageAttached) {
                // メディアのデータを圧縮
                const compressTasks: Array<Promise<ArrayBuffer>> = []
                mediaData.images.forEach((value, index) => {
                    if (typeof value.blob !== "undefined") {
                        const file: File = new File(
                            [value.blob],
                            `media${index}.data`,
                            { type: value.blob.type },
                        )
                        compressTasks.push(
                            browserImageCompression(file).then(
                                async value => await value.arrayBuffer(),
                            ),
                        )
                    }
                })
                // compressを並列処理
                const resultCompress: Array<ArrayBuffer> = await Promise.all(
                    compressTasks,
                ).then(values => {
                    return values
                })

                // 元の Blob から画像サイズを取得しておく
                const imageSizeTasks = mediaData.images.map((v) =>
                    typeof v.blob !== "undefined" && v.blob !== null
                        ? getImageSize(v.blob)
                        : Promise.resolve(undefined),
                )
                const imageSizes: Array<{ width: number; height: number } | undefined> = await Promise.all(
                    imageSizeTasks,
                )

                const uploadBlobTasks: Array<Promise<uploadBlobResult>> = []
                resultCompress.forEach(value => {
                    uploadBlobTasks.push(
                        uploadBlob({
                            accessJwt: session.accessJwt,
                            mimeType: "image/jpeg",
                            blob: new Uint8Array(value),
                        }),
                    )
                })
                // uploadBlobを並列処理し、その結果を格納する
                const resultUploadBlob: uploadBlobResult[] = await Promise.all(
                    uploadBlobTasks,
                ).then(values => {
                    return values
                })
                // Blobのアップロードに失敗したファイルが一つでも存在した場合停止する
                const resultUploadBlobSuccess: uploadBlobSuccessResult[] =
                    resultUploadBlob.map(value => {
                        if ("error" in value) {
                            const e: Error = new Error(value.message)
                            e.name = value.error
                            throw e
                        }
                        return value
                    })

                // Recordの作成
                switch (mediaData.type) {
                    case "images":
                        Record = {
                            ...Record,
                            embed: {
                                $type: "app.bsky.embed.images",
                                images: resultUploadBlobSuccess.map(
                                    (value, index) => {
                                        return {
                                            image: value.blob,
                                            alt: mediaData.images[index].alt,
                                            aspectRaito: imageSizes[index]
                                                ? {
                                                      width: imageSizes[index]!.width,
                                                      height: imageSizes[index]!.height,
                                                  }
                                                : undefined,
                                        }
                                    },
                                ),
                            },
                        }
                        break
                    case "external":
                        // 外部OGPがない場合はthumbはundefinedとする
                        Record = {
                            ...Record,
                            embed: {
                                $type: "app.bsky.embed.external",
                                external: {
                                    thumb:
                                        resultUploadBlobSuccess.length >= 1
                                            ? resultUploadBlobSuccess[0].blob
                                            : undefined,
                                    uri: mediaData.meta.url,
                                    title: mediaData.meta.title,
                                    description: mediaData.meta.description,
                                },
                            },
                        }
                        // Bluesky側Post本文にURLのリンクカードがない場合はintent宛に埋め込む
                        if (
                            callbackPostOptions.externalPostText.indexOf(
                                mediaData.meta.url,
                            ) < 0
                        ) {
                            callbackPostOptions.externalPostText += `${postText !== "" ? "\n" : ""}${mediaData.meta.url}`
                        }
                        break
                }
            }
            setMsgInfo({
                msg: "Blueskyへポスト中...",
                isError: false,
            })
            const createRecordResult = await createRecord({
                repo: session.did,
                accessJwt: session.accessJwt,
                record: Record,
            })
            if ("error" in createRecordResult) {
                const e: Error = new Error(createRecordResult.message)
                e.name = createRecordResult.error
                throw e
            }
            setMsgInfo({
                msg: "Blueskyへポストしました!",
                isError: false,
            })
            // noGenerateではない場合かつ、添付メディアがimagesタイプの場合
            if (
                !options.noGenerateOgp &&
                ImageAttached &&
                mediaData.type === "images"
            ) {
                setMsgInfo({
                    msg: "X用ページ生成中...",
                    isError: false,
                })
                const createPageResult = await createPage({
                    accessJwt: session.accessJwt,
                    uri: createRecordResult.uri,
                })
                if ("error" in createPageResult) {
                    const e: Error = new Error(createPageResult.message)
                    e.name = createPageResult.error
                    throw e
                }
                setMsgInfo({
                    msg: "生成したOGPの取得中...",
                    isError: false,
                })
                const [id, rkey] = createPageResult.uri.split(/[@/]/)
                const dbIndex = createPageResult.dbIndex.toString()
                const ogpUrl = new URL(`${pagesPrefix}/${dbIndex}/${id}@${rkey}/`, siteurl)
                // 本文に生成URLを付与
                callbackPostOptions.externalPostText += `${
                    postText !== "" ? "\n" : ""
                }${ogpUrl.toString()}`
                // 生成URLからogpを取得
                const getOgpMetaResult = await getOgpMeta({
                    siteurl,
                    externalUrl: ogpUrl.toString(),
                    languageCode: language,
                })
                if (getOgpMetaResult.type === "error") {
                    const e: Error = new Error(getOgpMetaResult.message)
                    e.name = getOgpMetaResult.error
                    throw e
                }
                callbackPostOptions.previewTitle = getOgpMetaResult.title
                if (getOgpMetaResult.image !== "") {
                    callbackPostOptions.previewData = await getOgpBlob({
                        siteurl,
                        externalUrl: getOgpMetaResult.image,
                        languageCode: language,
                    })
                }
                setMsgInfo({
                    msg: "X用ポストの作成が完了しました!",
                    isError: false,
                })
            }
            // 外部URLの場合は取得済みであろう内容を使用する
            if (
                typeof mediaData !== "undefined" &&
                mediaData.type === "external"
            ) {
                if (ImageAttached) {
                    const blob = mediaData.images[0].blob!
                    callbackPostOptions.previewData = blob
                }
                callbackPostOptions.previewTitle = mediaData.meta.title
            }
            // callbackを起動
            callback(callbackPostOptions)
        } catch (error: unknown) {
            let msg: string = "Unexpected Unknown Error"
            if (error instanceof Error) {
                msg = error.name + ": " + error.message
            }
            setMsgInfo({
                msg: msg,
                isError: true,
            })
        }
        setProcessing(false)
    }

    /**
     * Ctrl+Enterが押されたかどうかを判定します
     * @param e キーボードイベント
     * @returns Ctrl+Enterが押された場合true
     */
    const isCtrlEnterPressed: KeyPredicate = e => {
        if (e.key === "Enter") {
            if (isAssumedAsAppleProdUser) {
                return e.metaKey === true
            }
            return e.ctrlKey === true
        }
        return false
    }

    // Ctrl+Enterが押された場合に投稿する
    useKey(isCtrlEnterPressed, () => {
        handlePost().catch((e: unknown) => {
            const msg: string =
                e instanceof Error
                    ? `${e.name}: ${e.message}`
                    : "Unexpected Error@PostForm.tsx"
            setMsgInfo({
                msg: msg,
                isError: true,
            })
        })
    })

    return (
        <ProcButton
            buttonID="post"
            handler={handlePost}
            isProcessing={isProcessing}
            context={<span className={["my-auto"].join(" ")}>投稿</span>}
            color="blue"
            className={["my-0", "py-0.5", "align-middle"]}
            disabled={disabled}
        />
    )
}
export default Component
