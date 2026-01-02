// utils
import { memo, useState, Dispatch, SetStateAction, useEffect } from "react"

// components
import Tweetbox from "../common/Tweetbox"
import TextInputBox from "./unique/TextInputBox"
import callPopup from "../intents/callPopup"
import AutoXPopupToggle from "./optionToggles/AutoXPopupToggle"
import NoGenerateToggle from "./optionToggles/NoGenerateToggle"
import ShowTaittsuuToggle from "./optionToggles/ShowTaittsuuToggle"
import ForceIntentToggle from "./optionToggles/ForceIntentToggle"
import AppendViaToggle from "./optionToggles/AppendViaToggle"
import UseWebAPIToggle from "./optionToggles/UseWebAPIToggle"
import LanguageSelectList from "./selectLists/LanguageSelectList"
import Details from "../common/Details"
import TagInputList from "./unique/TagInputList"
import SelfLabelsSelectList from "./selectLists/SelfLabelsSelectList"
import LinkcardAttachButton, {
    handleGetOGP,
} from "./buttons/LinkcardAttachButton"
import PostButton from "./buttons/PostButton"
import AddImageButton from "./buttons/AddImageButton"
import MediaPreview from "./MediaPreview"
import DraftSaveButton from "./buttons/DraftSaveButton"
import DraftDialog from "./unique/DraftDialog"
import AnnounceLabel from "@/components/Client/common/AnnounceLabel"

// atproto
import { label } from "@/utils/atproto_api/labels"

// service
import { link } from "../common/tailwindVariants"
import { popupPreviewOptions } from "../intents/types"
import { type msgInfo, type modes, MediaData } from "../common/types"

// resources
import share from "@/images/share.svg"

const MemoMediaPreview = memo(MediaPreview)

export type callbackPostOptions = {
    externalPostText: string
    previewTitle: string | undefined
    previewData: Blob | undefined
    isNeedChangeMode: boolean
}

/**
 * リクエストパラメータから投稿テキストの初期値を生成します
 * @param searchParams リクエストパラメータ
 * @returns 投稿テキストの初期値
 */
const createInitialPostText = (searchParams: URLSearchParams) => {
    const sharedTitle: string | null = searchParams.get("sharedTitle")
    const sharedText: string | null = searchParams.get("sharedText")
    const sharedUrl: string | null = searchParams.get("sharedUrl")

    let sharedContent: string = ""
    if (sharedTitle !== null) {
        sharedContent += `${sharedTitle}\n`
    }
    if (sharedText !== null) {
        sharedContent += `${sharedText}\n`
    }
    if (sharedUrl !== null) {
        sharedContent += `${sharedUrl}\n`
    }
    return sharedContent
}

/** リクエストパラメータ */
const searchParams = new URLSearchParams(window.location.search)
/** 投稿テキストの初期値 */
const initialPostText: string = createInitialPostText(searchParams)

const Component = ({
    setMsgInfo,
    isProcessing,
    setProcessing,
    setMode,
    mediaData,
    setMediaData,
    setPopupPreviewOptions,
}: {
    setMsgInfo: Dispatch<SetStateAction<msgInfo>>
    isProcessing: boolean
    setProcessing: Dispatch<SetStateAction<boolean>>
    setMode: Dispatch<SetStateAction<modes>>
    mediaData: MediaData
    setMediaData: Dispatch<SetStateAction<MediaData>>
    setPopupPreviewOptions: Dispatch<SetStateAction<popupPreviewOptions>>
}) => {
    // Post内容を格納する変数とディスパッチャー
    const [postText, setPostText] = useState<string>(initialPostText)
    // Postの実行状態を管理する変数とディスパッチャー
    const [language, setLanguage] = useState<string>("ja")
    // 下書きのstate情報
    const [drafts, setDrafts] = useState<Array<string>>([])
    // ユーザエージェント
    const userAgent = window.navigator.userAgent.toLowerCase()

    // Options
    // ポスト時に自動でXを開く
    const [autoPop, setAutoPop] = useState<boolean>(false)
    // OGP画像を生成しない（Embedを有効にする）
    const [noGenerate, setNoGenerate] = useState<boolean>(false)
    // OGP画像を生成しない（Embedを有効にする）
    const [noUseXApp, setNoUseXApp] = useState<boolean>(false)
    // タイッツーボタンを表示する
    const [showTaittsuu, setShowTaittsuu] = useState<boolean>(false)
    // メディアに対してラベル付与を行う
    const [selfLabel, setSelfLabel] = useState<label.value | null>(null)
    // viaを付与する
    const [appendVia, setAppendVia] = useState<boolean>(false)
    // viaを付与する
    const [useWebAPI, setUseWebAPI] = useState<boolean>(false)

    // 判定式
    const isAutoPop = autoPop && !useWebAPI
    const isNoGenerate = useWebAPI || noGenerate

    useEffect(() => {
        const handleDragOver = (e: DragEvent) => {
            // 通常の動作を抑制する
            e.preventDefault()
        }
        window.addEventListener("dragover", handleDragOver)
        const getOGP = async () => {
            await handleGetOGP({
                postText,
                setProcessing,
                setMsgInfo,
                setMediaData,
            })
        }
        if (postText !== "") {
            getOGP().catch((_: unknown) => {})
        }

        return () => {
            window.removeEventListener("dragover", handleDragOver)
        }
    }, [])

    /**
     * 投稿リセット（下書きを削除）ボタンを押した際の動作
     */
    const handlerCancel = () => {
        setMediaData(undefined)
        setPostText("")
    }

    /**
     * PostButtonコンポーネントのcallback関数
     * @param options callback元から取得したいオプション
     */
    const callbackPost = (options: callbackPostOptions) => {
        if (isAutoPop) {
            callPopup({
                postText: options.externalPostText,
                kind: "xcom",
            })
        }
        const mediaObjectURL: string | undefined = options.previewData
            ? URL.createObjectURL(options.previewData)
            : undefined
        const popupPreviewOptions: popupPreviewOptions = {
            postText: options.externalPostText,
            mediaObjectURL: mediaObjectURL,
            ogpTitle: options.previewTitle,
        }
        if (options.isNeedChangeMode) {
            setPopupPreviewOptions(popupPreviewOptions)
            setMode("xcom")
        }
        handlerCancel()
    }

    /**
     * ポスト可能かどうかを判定します
     * @returns ポスト可能な場合true
     */
    const isValidPost = () =>
        postText.length >= 1 ||
        (typeof mediaData !== "undefined" && mediaData.images.length > 0)

    return (
        <Tweetbox>
            <AnnounceLabel />
            <div className="flex">
                <button
                    onClick={handlerCancel}
                    className={link({
                        enabled: isValidPost(),
                        class: ["inline-block", "mx-2", "flex-none"],
                    })}
                    disabled={!isValidPost()}
                >
                    下書きを消す
                </button>
                <div className="flex-1"></div>
                <SelfLabelsSelectList
                    disabled={isProcessing}
                    setSelfLabel={setSelfLabel}
                    selectedLabel={selfLabel}
                />
                <div className="flex-none my-auto">
                    <PostButton
                        postText={postText}
                        language={language}
                        selfLabel={selfLabel}
                        options={{
                            noGenerateOgp: isNoGenerate,
                            appendVia: appendVia,
                            useWebAPI: useWebAPI,
                        }}
                        mediaData={mediaData}
                        callback={callbackPost}
                        isProcessing={isProcessing}
                        setProcessing={setProcessing}
                        setMsgInfo={setMsgInfo}
                        disabled={!isValidPost()}
                        userAgent={userAgent}
                    />
                </div>
            </div>
            <TextInputBox
                postText={postText}
                setPostText={setPostText}
                mediaData={mediaData}
                setMediaData={setMediaData}
                disabled={isProcessing}
            >
                <DraftSaveButton
                    postText={postText}
                    setPostText={setPostText}
                    setDrafts={setDrafts}
                    setMsgInfo={setMsgInfo}
                    className={[
                        "absolute",
                        "bottom-1",
                        "left-1",
                        "text-xs",
                        "py-0.5",
                    ]}
                />
            </TextInputBox>
            <LinkcardAttachButton
                postText={postText}
                setMediaData={setMediaData}
                isProcessing={isProcessing}
                setProcessing={setProcessing}
                setMsgInfo={setMsgInfo}
            />
            <div className="flex">
                <AddImageButton
                    disabled={isProcessing}
                    mediaData={mediaData}
                    setMediaData={setMediaData}
                />
                <div className="flex-1 my-auto"></div>
                <DraftDialog
                    setPostText={setPostText}
                    drafts={drafts}
                    setDrafts={setDrafts}
                />
                <LanguageSelectList
                    disabled={isProcessing}
                    setLanguage={setLanguage}
                />
            </div>
            <div className="mx-2 my-auto">
                <div className="flex w-full">
                    <div className="flex-none my-auto">よく使うタグ: </div>
                    <TagInputList
                        postText={postText}
                        setPostText={setPostText}
                        disabled={isProcessing}
                    />
                </div>
                <div className="flex flex-wrap my-2 mx-2 gap-x-8 gap-y-1">
                    <UseWebAPIToggle
                        labeltext={
                            <>
                                共有ﾒﾆｭｰ
                                <img
                                    src={share.src}
                                    className={[
                                        "h-8",
                                        "p-0.5",
                                        "inline-block",
                                        "align-middle",
                                    ].join(" ")}
                                />
                                でアプリ版Xを開いて投稿する
                            </>
                        }
                        prop={useWebAPI}
                        setProp={setUseWebAPI}
                        setMsgInfo={setMsgInfo}
                    />
                    <AutoXPopupToggle
                        labeltext={"ブラウザ版Xを自動でポップアップする"}
                        prop={isAutoPop}
                        setProp={setAutoPop}
                        isLocked={useWebAPI}
                    />
                    <NoGenerateToggle
                        labeltext={"Xへの画像は自身で添付する"}
                        prop={isNoGenerate}
                        setProp={setNoGenerate}
                        isLocked={useWebAPI}
                    />
                </div>
            </div>
            <MemoMediaPreview
                mediaData={mediaData}
                setMediaData={setMediaData}
            />
            <div className="mx-2 my-auto">
                <Details
                    summaryLabel="実験的な機能"
                    initHidden={!(showTaittsuu || noUseXApp || appendVia)}
                >
                    <div className="flex flex-wrap">
                        <ShowTaittsuuToggle
                            labeltext={"タイッツーの投稿ボタンも表示する"}
                            prop={showTaittsuu}
                            setProp={setShowTaittsuu}
                        />
                        <AppendViaToggle
                            labeltext={"Viaを付与する"}
                            prop={appendVia}
                            setProp={setAppendVia}
                        />
                        <ForceIntentToggle
                            labeltext={
                                "デバイス固有URLを用いてポップアップを実行する"
                            }
                            prop={noUseXApp}
                            setProp={setNoUseXApp}
                        />
                    </div>
                </Details>
            </div>
        </Tweetbox>
    )
}

export default Component
