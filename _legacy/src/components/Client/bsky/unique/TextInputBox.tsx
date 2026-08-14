// utils
import {
    Dispatch,
    ReactNode,
    SetStateAction,
    useContext,
    useEffect,
    useState,
    useRef,
} from "react"
import twitterText from "twitter-text"

// service
import { inputtext_base } from "../../common/tailwindVariants"
import { Profile_context } from "../../common/contexts"
import { MediaData } from "../../common/types"
import { addImageMediaData, collectNewImages } from "../lib/addImageMediaData"

const Component = ({
    postText,
    setPostText,
    mediaData,
    setMediaData,
    disabled,
    children,
}: {
    postText: string
    setPostText: Dispatch<SetStateAction<string>>
    mediaData: MediaData
    setMediaData: Dispatch<SetStateAction<MediaData>>
    disabled: boolean
    children?: ReactNode
}) => {
    // Postの入力上限 (Bsky)
    const countMax = 300
    // PostのWarining上限 （= Xの入力上限）
    const countWarn = 140
    const { profile } = useContext(Profile_context)
    const textAreaRef = useRef<HTMLTextAreaElement>(null)
    const [isFileDragEnter, setIsFileDragEnter] = useState<boolean>(false)

    const isMobileDevice = () => {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent,
        ) // FIXME: ChatGPT の出力そのままなので精査が必要
    }

    useEffect(() => {
        if (textAreaRef.current && !isMobileDevice()) {
            textAreaRef.current.focus()
        }
    }, [])

    // DragEnterイベント
    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setIsFileDragEnter(true)
    }
    // DragOverイベント
    const handleOnDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        // コンポーネントへのDropを許容する
        e.dataTransfer.dropEffect = "copy"
        e.dataTransfer.effectAllowed = "copy"
        setIsFileDragEnter(true)
    }
    // DragLeaveイベント
    const handleOnDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setIsFileDragEnter(false)
    }

    const handleOnDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setIsFileDragEnter(false)
        const items: DataTransferItemList = e.dataTransfer.items
        if (items.length <= 0) {
            return
        }
        const newImageFiles = collectNewImages(items)
        if (newImageFiles.length <= 0) {
            return
        }
        addImageMediaData(newImageFiles, mediaData, setMediaData)
    }

    // textarea のフォーカスイベントを処理します
    const handleOnFocus = () => {
        setTimeout(() => {
            if (textAreaRef.current && isMobileDevice()) {
                const scrollToY =
                    textAreaRef.current.getBoundingClientRect().top +
                    window.scrollY -
                    50
                // FIXME: いまは数字が適当（50 のところ）
                window.scrollTo({ top: scrollToY, behavior: "smooth" })
            }
        }, 100) // FIXME: 数字調整が必要かも？
    }

    // textareaの変更イベント
    const handleOnChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setPostText(event.target.value)
    }

    /**
     * ペーストイベントを処理します
     * @param e クリップボードイベント
     */
    const handleOnPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items: DataTransferItemList = e.clipboardData.items
        if (items.length <= 0) {
            return
        }
        const newImageFiles = collectNewImages(items)
        if (newImageFiles.length <= 0) {
            return
        }
        // NOTE 画像ファイルが含まれている場合は文字列のペーストを抑制
        e.preventDefault()
        addImageMediaData(newImageFiles, mediaData, setMediaData)
    }

    /**
     * Xでの文字数カウントを返します（端数切り上げ）
     * @returns 文字数
     */
    const textCountOnX = (): number => {
        try {
            return Math.ceil(
                twitterText.parseTweet(postText).weightedLength / 2,
            )
        } catch {
            // 念の為例外を追加
            return postText.length
        }
    }

    /**
     * blueskyでの文字数カウントを返却
     * @returns 文字数
     */
    const textCount = (): number => {
        try {
            const segmenterJa = new Intl.Segmenter("ja-JP", {
                granularity: "grapheme",
            })
            const segments = segmenterJa.segment(postText)
            return Array.from(segments).length
        } catch (_) {
            // Intl.Segmenterがfirefoxでは未対応であるため、やむをえずレガシーな方法で対処
            // 絵文字のカウント数が想定より多く設定されてしまうため、firefox_v125までは非推奨ブラウザとする
            return postText.length
        }
    }

    return (
        <div
            onDragEnter={handleDragEnter}
            onDragOver={handleOnDragOver}
            onDrop={handleOnDrop}
            onDragLeave={handleOnDragLeave}
            className={inputtext_base({
                kind: "outbound",
                disabled: disabled,
                class: "relative",
                onDragEnter: isFileDragEnter,
            })}
        >
            {/* Icon/Textboxのエリア */}
            <div className="flex m-0 mb-8">
                <div className="flex-none ml-2 mt-2 w-fit">
                    <img
                        src={profile ? profile.avatar : undefined}
                        className="w-12 h-12 inline-block rounded-full bg-sky-400"
                    />
                </div>
                <textarea
                    ref={textAreaRef}
                    onChange={handleOnChange}
                    onPaste={handleOnPaste}
                    onFocus={handleOnFocus}
                    value={postText}
                    placeholder={
                        "最近どう？いまどうしてる？\n画像ファイルのドラッグ&ドロップ、クリップボードの画像ペーストが可能です。"
                    }
                    disabled={disabled}
                    className={inputtext_base({
                        kind: "inbound",
                        class: [
                            "mt-1",
                            "py-0",
                            "w-full",
                            "md:w-lg",
                            "resize-y",
                            "overflow-y-auto",
                            "h-48",
                            "mb-0",
                            "flex-1",
                        ],
                        disabled: disabled,
                    })}
                />
            </div>
            {/* positionによる自由配置要素 */}
            <div
                className={
                    [
                        "absolute",
                        "rounded-lg",
                        "opacity-85",
                        "text-sm",
                        "px-2",
                        "m-0",
                        "bottom-1",
                        "right-1",
                        "w-fit",
                        "flex",
                        "text-right",
                    ].join(" ") +
                    ` ${textCount() > countMax ? "bg-red-300" : ""}${
                        textCountOnX() > countWarn && textCount() <= countMax
                            ? "bg-amber-300"
                            : ""
                    }`
                }
            >
                <span className={["w-fit"].join(" ")}>
                    {`${textCountOnX()}/${countWarn}:X`}
                </span>
                {/* ガタガタさせないように固定長 */}
                <span className={["w-32"].join(" ")}>
                    {`${textCount()}/${countMax}:Bluesky`}
                </span>
            </div>
            {/* 子コンポーネントがある場合はこれも配置 */}
            {children}
        </div>
    )
}
export default Component
