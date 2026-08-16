/**
 * 投稿フォームコンポーネント。
 *
 * 責務と処理概要:
 * - テキスト投稿・画像投稿・OGP 投稿の入力状態を管理する。
 * - 送信時に OpenAPI 契約へ整形し、画像投稿は `createEntry`（skyshare entry を伴う）、
 *   テキスト・OGP投稿は `createBskyRecord`（skyshare entry を伴わない）を呼び出す。
 * - 画像投稿では不足しうる `imagesMeta` を補完して送信する。
 */
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import {
  createBskyRecord,
  createDraft,
  createEntry,
  deleteDraft,
  getDrafts,
  updateDraft,
} from "@/client/openapi/client"
import type {
  CreateBskyRecordBody,
  CreateEntryBody,
} from "@/client/openapi/model"
import type { CreateEntryBodySelfLabels } from "@/client/openapi/model"
import Collapsible from "@/components/Collapsible/index"
import CountedTextInput, {
  type CounterSpec,
} from "@/components/CountedTextInput"
import DraftListPanel from "@/components/DraftListPanel"
import DraftSaveConfirmDialog from "@/components/DraftSaveConfirmDialog"
import ImagePicker, {
  type ImageEntry,
  type ImagePickerHandle,
} from "@/components/ImagePicker"
import ImagePreview from "@/components/ImagePreview"
import LanguageSelect from "@/components/LanguageSelect"
import Loading from "@/components/Loading"
import {
  OgpFetchButton,
  useOgpFetch,
  type OgpResult,
} from "@/components/OgpFetchButton"
import OgpPreview from "@/components/OgpPreview"
import Overlay from "@/components/Overlay"
import SelfLabelsSelect from "@/components/SelfLabelsSelect"
import ToggleSwitch from "@/components/ToggleSwitch"
import { normalizeDraftList } from "@/lib/entry/draftList"
import {
  readCrosspostToTaittsuuSetting,
  readOpenPopupSetting,
  readShowCrosspostXButtonSetting,
  writeCrosspostToTaittsuuSetting,
  writeOpenPopupSetting,
  writeShowCrosspostXButtonSetting,
} from "@/lib/settings/shareSettings"
import {
  buildTaittsuuIntentText,
  openTaittsuuIntentPopup,
} from "@/util/share/taittsuuIntent"
import { countGraphemes, countWeightedTweetLength } from "@/util/textCount"
import { canShareWithWebApi, shareWithWebApi } from "@/util/share/webShare"
import { buildXIntentText, openXIntentPopup } from "@/util/share/xIntent"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

type Props = {
  onClose?: () => void
  onPosted?: () => void
  avatarUrl?: string | null
}

/**
 * 親（PostLauncher の Overlay など）から閉じ操作を要求するための命令的ハンドル。
 */
export type PostFormHandle = {
  requestClose: () => void
}

type ImageSizeCandidate = {
  width?: number
  height?: number
}

/**
 * API エラーコードを表示文言へ変換する。
 *
 * Input:
 * - `errorCode`: API から返却されたエラーコード
 *
 * Output:
 * - ユーザー向け日本語メッセージ
 *
 * 例:
 * - 入力: "APP_BSKY_POST_FAILED"
 * - 出力: "Blueskyへの投稿に失敗しました。"
 */
const resolveEntryErrorMessage = (errorCode: string) => {
  switch (errorCode) {
    case "APP_BSKY_POST_FAILED":
      return "Blueskyへの投稿に失敗しました。"
    case "SKYSHARE_ENTRY_CREATE_FAILED":
      return "Blueskyへの投稿は成功しましたが、SkyShareレコード作成に失敗しました。"
    case "ENTRY_CREATE_UNEXPECTED_ERROR":
      return "投稿処理中に予期せぬエラーが発生しました。"
    default:
      return errorCode
  }
}

/**
 * ImagePicker が生成した object URL を解放する。
 *
 * Input:
 * - `entry`: プレビュー URL を保持する画像エントリ
 *
 * Output:
 * - なし
 *
 * 例:
 * - 入力: 画像付きの `ImageEntry`
 * - 出力: 関連する object URL を解放
 */
const revokeImageEntry = (entry: ImageEntry | null) => {
  if (!entry) return

  try {
    entry.originalPreviews?.forEach(p => {
      try {
        URL.revokeObjectURL(p)
      } catch (e) {}
    })
    try {
      URL.revokeObjectURL(entry.thumbnailPreview)
    } catch (e) {}
  } catch (error) {
    console.warn("Failed to revoke object URL", error)
  }
}

/**
 * Blob から画像の自然サイズを読み取る。
 *
 * 処理の趣旨:
 * - ImagePicker 側でサイズ取得に失敗した場合でも、送信直前に API 必須の width/height を補完する。
 *
 * Input:
 * - `blob`: 投稿対象の画像 Blob
 *
 * Output:
 * - `{ width, height }`
 *
 * 例:
 * - 入力: JPEG Blob
 * - 出力: `{ width: 1200, height: 630 }`
 */
const loadBlobImageSize = async (blob: Blob) => {
  const objectUrl = URL.createObjectURL(blob)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image()
      nextImage.onload = () => resolve(nextImage)
      nextImage.onerror = () =>
        reject(new Error("画像サイズの取得に失敗しました。"))
      nextImage.src = objectUrl
    })

    if (image.naturalWidth < 1 || image.naturalHeight < 1) {
      throw new Error("画像サイズが不正です。")
    }

    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/**
 * 画像サイズ候補が API 契約を満たす完全な width/height を持つか判定する。
 *
 * Input:
 * - `value`: ImagePicker が保持している画像サイズ候補
 *
 * Output:
 * - 完全なサイズなら `true`
 *
 * 例:
 * - 入力: `{ width: 800, height: 600 }`
 * - 出力: `true`
 */
const hasValidImageSize = (
  value: ImageSizeCandidate,
): value is { width: number; height: number } => {
  return (
    typeof value?.width === "number" &&
    value.width > 0 &&
    typeof value.height === "number" &&
    value.height > 0
  )
}

/**
 * 画像投稿用の imagesMeta を必ず完全な形で組み立てる。
 *
 * 想定する入力形状:
 * - `entry.originalBlobs` は投稿対象画像の配列
 * - `entry.meta` は ImagePicker が保持する元画像サイズ配列（欠落の可能性あり）
 *
 * 処理の趣旨:
 * - 既存メタデータが完全ならそれを利用する。
 * - 欠落がある場合は Blob から再読込して API 契約を満たす。
 *
 * Input:
 * - `entry`: 投稿対象の画像エントリ
 *
 * Output:
 * - API に送信できる `imagesMeta`
 *
 * 例:
 * - 入力: meta が完全な `ImageEntry`
 * - 出力: 既存 meta をそのまま返す
 */
const resolveImageMetadata = async (
  entry: ImageEntry,
): Promise<NonNullable<CreateEntryBody["imagesMeta"]>> => {
  const imageSizes = entry.meta ?? []
  const hasCompleteImageSizes =
    imageSizes.length === entry.originalBlobs.length &&
    imageSizes.every(hasValidImageSize)

  if (hasCompleteImageSizes) {
    return imageSizes.map(value => ({
      width: value.width,
      height: value.height,
    }))
  }

  return Promise.all(entry.originalBlobs.map(loadBlobImageSize))
}

/**
 * 共有オプション折りたたみの初期開閉状態を決める。
 *
 * 処理の趣旨:
 * - フォーム表示時点で、共有系トグルが1つでも ON なら詳細設定を開いたまま見せる。
 * - すべて OFF の場合のみ折りたたんだ状態で開始する。
 *
 * Input:
 * - `openXPopup`: ポップアップ利用トグル
 * - `crosspostToTaittsuu`: タイッツー連携トグル
 * - `showXWhenCrosspost`: X 投稿ボタン表示トグル
 *
 * Output:
 * - 初回表示時に折りたたみを開くべきなら `true`
 *
 * 例:
 * - 入力: `{ openXPopup: false, crosspostToTaittsuu: true, showXWhenCrosspost: false }`
 * - 出力: `true`
 */
const resolveShareOptionsDefaultOpen = ({
  openXPopup,
  crosspostToTaittsuu,
  showXWhenCrosspost,
}: {
  openXPopup: boolean
  crosspostToTaittsuu: boolean
  showXWhenCrosspost: boolean
}) => {
  return openXPopup || crosspostToTaittsuu || showXWhenCrosspost
}

/**
 * 投稿フォーム本体を描画する。
 *
 * Input:
 * - `onClose`: フォームクローズ時コールバック
 * - `avatarUrl`: 表示用アバター URL
 *
 * Output:
 * - 投稿入力 UI 一式
 *
 * 例:
 * - 入力: `{ avatarUrl: "https://..." }`
 * - 出力: テキスト・画像・OGP を扱える投稿フォーム
 */
export const Component = forwardRef<PostFormHandle, Props>(function PostForm(
  { onClose, onPosted, avatarUrl },
  ref,
) {
  const [text, setText] = useState("")
  const [languageCode, setLanguageCode] = useState("ja")
  const [crosspostToTaittsuu, setCrosspostToTaittsuu] = useState(() =>
    readCrosspostToTaittsuuSetting(false),
  )
  const [openXPopup, setOpenXPopup] = useState(() =>
    readOpenPopupSetting(false),
  )
  const [showXWhenCrosspost, setShowXWhenCrosspost] = useState(() =>
    readShowCrosspostXButtonSetting(false),
  )
  const [selfLabel, setSelfLabel] = useState<
    CreateEntryBodySelfLabels | undefined
  >(undefined)
  const [status, setStatus] = useState<string | null>(null)
  const [statusColor, setStatusColor] = useState<string | undefined>(undefined)
  const [imageEntry, setImageEntry] = useState<ImageEntry | null>(null)
  const [ogpResult, setOgpResult] = useState<OgpResult | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [draftModalOpen, setDraftModalOpen] = useState(false)
  const [draftItems, setDraftItems] = useState<
    ReturnType<typeof normalizeDraftList>
  >([])
  const [draftListLoading, setDraftListLoading] = useState(false)
  const [draftListError, setDraftListError] = useState<string | null>(null)
  const [loadedDraft, setLoadedDraft] = useState<{
    id: string
    text: string
    label?: CreateEntryBodySelfLabels
  } | null>(null)
  const [draftSaveConfirmOpen, setDraftSaveConfirmOpen] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [isDraggingImage, setIsDraggingImage] = useState(false)
  const imagePickerRef = useRef<ImagePickerHandle>(null)

  const bskyMaxCount = 300
  const xWarnCount = 140
  const textCounters: CounterSpec[] = [
    {
      key: "x",
      label: "X",
      count: countWeightedTweetLength,
      maxAssumed: xWarnCount,
      warnAt: xWarnCount,
    },
    {
      key: "bsky",
      label: "Bluesky",
      count: countGraphemes,
      maxAssumed: bskyMaxCount,
      errorAt: bskyMaxCount,
    },
  ]

  const showXIntentButton = openXPopup && showXWhenCrosspost
  const showTaittsuuIntentButton = openXPopup && crosspostToTaittsuu
  const hasTextInput = text.trim().length > 0
  const defaultOpenShareOptions = resolveShareOptionsDefaultOpen({
    openXPopup,
    crosspostToTaittsuu,
    showXWhenCrosspost,
  })

  const ogpFetch = useOgpFetch({
    text,
    value: ogpResult,
    onChange: nextOgp => {
      if (nextOgp) {
        setImageEntry(prevImageEntry => {
          revokeImageEntry(prevImageEntry)
          return null
        })
      }
      setOgpResult(nextOgp)
    },
    disabled: isSubmitting,
  })

  useEffect(() => {
    return () => {
      revokeImageEntry(imageEntry)
    }
  }, [imageEntry])

  /**
   * 投稿フォームの入力内容を初期状態へ戻す。
   *
   * Input:
   * - なし
   *
   * Output:
   * - なし
   *
   * 例:
   * - 入力: 任意の入力済み状態
   * - 出力: テキスト・画像・OGP・ステータスをリセット
   */
  const clearForm = () => {
    setText("")
    setSelfLabel(undefined)
    setImageEntry(prevImageEntry => {
      revokeImageEntry(prevImageEntry)
      return null
    })
    setOgpResult(null)
    setStatus(null)
    setStatusColor(undefined)
    setLoadedDraft(null)
  }

  /**
   * 下書き一覧を取得して選択ダイアログを開く。
   *
   * Input:
   * - なし
   *
   * Output:
   * - なし（state 更新のみ）
   */
  const openDraftPicker = async () => {
    setDraftModalOpen(true)
    setDraftListLoading(true)
    setDraftListError(null)

    try {
      const res = await getDrafts({ limit: 100 })
      if (res.status !== 200) {
        setDraftItems([])
        setDraftListError("下書き一覧の取得に失敗しました。")
        return
      }

      setDraftItems(normalizeDraftList(res.data.drafts))
    } catch (error) {
      console.error("PostForm: failed to load drafts", error)
      setDraftItems([])
      setDraftListError("下書き一覧の取得に失敗しました。")
    } finally {
      setDraftListLoading(false)
    }
  }

  /**
   * 選択した下書きをフォームに注入する。
   *
   * Input:
   * - `draft`: 下書き一覧の 1 レコード
   *
   * Output:
   * - なし（フォームの state を更新）
   */
  const applyDraftToForm = (
    draft: ReturnType<typeof normalizeDraftList>[number],
  ) => {
    const label =
      draft.labels && draft.labels[0]
        ? (draft.labels[0] as CreateEntryBodySelfLabels)
        : undefined
    setText(draft.text ?? "")
    setSelfLabel(label)
    setLoadedDraft({ id: draft.id, text: draft.text ?? "", label })
    setStatus("下書きを反映しました。")
    setStatusColor("green")
  }

  /**
   * 投稿成功後、使用済みの下書きをバックグラウンドで削除する。
   *
   * 処理の趣旨:
   * - 投稿完了ステータスの表示を邪魔しないよう、失敗してもコンソール出力のみに留める。
   *
   * Input:
   * - `draftId`: 削除対象の下書き ID
   *
   * Output:
   * - なし
   */
  const deleteDraftSilently = async (draftId: string) => {
    try {
      const res = await deleteDraft({ id: draftId })
      if (res.status !== 200) {
        console.error("PostForm: failed to delete draft after posting")
      }
    } catch (error) {
      console.error("PostForm: failed to delete draft after posting", error)
    }
  }

  /**
   * 現在の入力内容が、開いている下書きから変更されているかを判定する。
   *
   * Input:
   * - なし（`text` / `selfLabel` / `loadedDraft` を参照）
   *
   * Output:
   * - 未保存の変更があれば `true`
   *
   * 例:
   * - 入力: 下書きを開かず本文だけ入力した状態
   * - 出力: `true`
   */
  const hasUnsavedDraftChanges = (): boolean => {
    if (!hasTextInput) return false
    if (!loadedDraft) return true
    return (
      loadedDraft.text !== text ||
      (loadedDraft.label ?? undefined) !== selfLabel
    )
  }

  /**
   * 下書きを保存(新規作成/更新)してからフォームを閉じる。
   *
   * 処理の趣旨:
   * - 既に開いている下書きがあれば更新 API、なければ作成 API を呼ぶ。
   * - 失敗時はダイアログを閉じずエラーを表示し、入力内容を保持する。
   *
   * Input:
   * - なし
   *
   * Output:
   * - なし
   */
  const handleSaveDraftAndClose = async () => {
    setIsSavingDraft(true)
    try {
      const labels = selfLabel ? [selfLabel] : undefined
      const res = loadedDraft
        ? await updateDraft({ id: loadedDraft.id, text, labels })
        : await createDraft({ text, labels })

      if (res.status !== 200) {
        setStatus("下書きの保存に失敗しました。")
        setStatusColor("#b00")
        return
      }

      setDraftSaveConfirmOpen(false)
      onClose?.()
    } catch (error) {
      console.error("PostForm: failed to save draft", error)
      setStatus("下書きの保存に失敗しました。")
      setStatusColor("#b00")
    } finally {
      setIsSavingDraft(false)
    }
  }

  /**
   * 下書きを保存せずフォームを閉じる。
   *
   * Input:
   * - なし
   *
   * Output:
   * - なし
   */
  const handleDiscardDraftAndClose = () => {
    setDraftSaveConfirmOpen(false)
    onClose?.()
  }

  /**
   * フォームを閉じる要求を処理する（キャンセルボタン・Overlay 背景クリック共通）。
   *
   * 処理の趣旨:
   * - 未保存の本文があれば保存確認ダイアログを開き、なければそのまま閉じる。
   * - PostLauncher の Overlay 背景クリックでも同じ判定を通すため、
   *   `useImperativeHandle` 経由で親コンポーネントから呼び出せるようにする。
   *
   * Input:
   * - なし
   *
   * Output:
   * - なし
   */
  const requestClose = () => {
    if (hasUnsavedDraftChanges()) {
      setDraftSaveConfirmOpen(true)
      return
    }
    onClose?.()
  }

  useImperativeHandle(ref, () => ({ requestClose }))

  /**
   * クリップボードから画像を貼り付けたときに `ImagePicker` へ受け渡す。
   *
   * 処理の趣旨:
   * - クリップボードに画像ファイルが含まれる場合のみ処理し、それ以外
   *   （通常のテキスト貼り付け）はブラウザ標準の挙動に委ねる。
   *
   * Input:
   * - `e`: 貼り付けイベント
   *
   * Output:
   * - なし（`imagePickerRef` 経由で画像を追加）
   */
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (isSubmitting) return

    const items = e.clipboardData?.items
    if (!items) return

    const files = Array.from(items)
      .filter(item => item.kind === "file" && item.type.startsWith("image/"))
      .map(item => item.getAsFile())
      .filter((file): file is File => file !== null)

    if (files.length === 0) return

    e.preventDefault()
    void imagePickerRef.current?.addFiles(files)
  }

  /**
   * ドラッグ中の要素がファイルを含む場合のみ、ドロップを許可する。
   *
   * Input:
   * - `e`: dragover イベント
   *
   * Output:
   * - なし
   */
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (isSubmitting) return
    if (!e.dataTransfer.types.includes("Files")) return
    e.preventDefault()
    setIsDraggingImage(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setIsDraggingImage(false)
  }

  /**
   * ドラッグ&ドロップされた画像ファイルを `ImagePicker` へ受け渡す。
   *
   * Input:
   * - `e`: drop イベント
   *
   * Output:
   * - なし（`imagePickerRef` 経由で画像を追加）
   */
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes("Files")) return
    e.preventDefault()
    setIsDraggingImage(false)
    if (isSubmitting) return

    const files = Array.from(e.dataTransfer.files).filter(file =>
      file.type.startsWith("image/"),
    )
    if (files.length === 0) return

    void imagePickerRef.current?.addFiles(files)
  }

  /**
   * 投稿フォームの内容を API 契約に合わせて送信する。
   *
   * Input:
   * - `e`: フォーム送信イベント
   *
   * Output:
   * - なし
   *
   * 例:
   * - 入力: テキストと画像付きフォーム送信
   * - 出力: createEntry を呼び出し、成功時は状態を更新
   */
  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setStatus("送信中…")
    setStatusColor(undefined)

    try {
      // skyshare entry を作成するのは画像投稿の場合のみ。画像が無い投稿
      // （テキスト投稿・OGP投稿）は skyshare entry を伴わないため、
      // v2/bsky 名前空間の純粋な bypass エンドポイントを使う。
      let skyshareUri = ""

      if (imageEntry) {
        const payload: CreateEntryBody = {
          text,
          langs: [languageCode],
          selfLabels: selfLabel,
          ogImage: imageEntry.thumbnailBlob,
          images: imageEntry.originalBlobs,
          imagesMeta: await resolveImageMetadata(imageEntry),
        }

        const res = await createEntry(payload)
        if (res.status !== 200) {
          setStatusColor("#b00")
          const errorCode =
            "error" in res.data && typeof res.data.error === "string"
              ? res.data.error
              : "投稿に失敗しました。"
          setStatus(resolveEntryErrorMessage(errorCode))
          return
        }

        skyshareUri = res.data.skyshare.uri
      } else {
        const payload: CreateBskyRecordBody = {
          text,
          langs: [languageCode],
          selfLabels: selfLabel,
        }

        if (ogpResult) {
          payload.ogMeta = ogpResult.meta
          payload.ogImage = ogpResult.imageBlob
        }

        const res = await createBskyRecord(payload)
        if (res.status !== 200) {
          setStatusColor("#b00")
          const errorCode =
            "error" in res.data && typeof res.data.error === "string"
              ? res.data.error
              : "投稿に失敗しました。"
          setStatus(resolveEntryErrorMessage(errorCode))
          return
        }
      }

      setStatusColor("green")
      if (loadedDraft) {
        void deleteDraftSilently(loadedDraft.id)
        setLoadedDraft(null)
      }
      onPosted?.()
      const shareText = buildXIntentText(text, skyshareUri)
      const taittsuuIntentText = buildTaittsuuIntentText(text, skyshareUri)

      // タイッツーと X の両方を有効化している場合は自動ポップアップを抑制する。
      if (crosspostToTaittsuu && showXWhenCrosspost) {
        setStatus(
          "投稿に成功しました。クロスポスト先のボタンを押して投稿してください。",
        )
      } else if (crosspostToTaittsuu) {
        const popupOpened = openTaittsuuIntentPopup(taittsuuIntentText)
        setStatus(
          popupOpened
            ? `投稿に成功しました。`
            : `投稿に成功しました。タイッツー投稿画面を開けませんでした。ポップアップブロックを確認してください。`,
        )
      } else if (openXPopup) {
        const popupOpened = openXIntentPopup(shareText)
        setStatus(
          popupOpened
            ? `投稿に成功しました。`
            : `投稿に成功しました。x.com 投稿画面を開けませんでした。ポップアップブロックを確認してください。`,
        )
      } else if (canShareWithWebApi()) {
        const shareResult = await shareWithWebApi({ text: shareText })
        if (shareResult.ok) {
          setStatus(`投稿に成功しました。`)
        } else if (shareResult.reason === "aborted") {
          setStatus(`投稿に成功しました。共有はキャンセルされました。`)
        } else {
          setStatus(`投稿に成功しました。WebShareAPI での共有に失敗しました。`)
        }
      } else {
        const popupOpened = openXIntentPopup(shareText)
        setStatus(
          popupOpened
            ? `投稿に成功しました。WebShareAPI 非対応のため x.com 投稿画面を開きました。`
            : `投稿に成功しました。x.com 投稿画面を開けませんでした。ポップアップブロックを確認してください。`,
        )
      }
    } catch (err) {
      console.error(err)
      setStatusColor("#b00")
      setStatus("サーバへ接続できませんでした。")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {draftListLoading && <Loading overlay message="下書きを読み込み中..." />}

      <Overlay
        open={draftModalOpen}
        onClose={() => setDraftModalOpen(false)}
        contentClassName={`${ui["width-lg"]} ${styles["draft-list-overlay"]}`}
      >
        <div
          className={`${ui["base-card"]} ${ui["dialog-card"]}`}
          role="dialog"
          aria-label="下書き一覧"
          style={{ maxHeight: "80vh", overflow: "hidden" }}
        >
          <div
            className={`${ui.toolbar} ${ui["toolbar-align"]} ${ui["toolbar-align-center"]}`}
          >
            <button
              type="button"
              className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]} ${ui["toolbar-item-left"]}`}
              onClick={() => setDraftModalOpen(false)}
            >
              閉じる
            </button>
            <div>下書き一覧</div>
          </div>

          <div className={styles["draft-list-body"]}>
            <DraftListPanel
              items={draftItems}
              loading={draftListLoading}
              error={draftListError ?? undefined}
              onSelectDraft={draft => {
                setDraftModalOpen(false)
                applyDraftToForm(draft)
                setDraftItems(prev => prev.filter(item => item.id !== draft.id))
              }}
            />
          </div>
        </div>
      </Overlay>

      <DraftSaveConfirmDialog
        open={draftSaveConfirmOpen}
        isSaving={isSavingDraft}
        onSave={handleSaveDraftAndClose}
        onDiscard={handleDiscardDraftAndClose}
        onContinueEditing={() => setDraftSaveConfirmOpen(false)}
      />

      <div
        className={`${ui["base-card"]} ${ui["dialog-card"]} ${isDraggingImage ? styles["drag-over"] : ""}`}
        role="dialog"
        aria-label="投稿フォーム"
        onPaste={handlePaste}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isSubmitting && <Loading overlay message="投稿中..." />}
        {isDraggingImage && (
          <div className={styles["drag-overlay"]} aria-hidden>
            画像をドロップして添付
          </div>
        )}
        <div
          className={`${ui.toolbar} ${ui["toolbar-align"]} ${ui["toolbar-align-between"]}`}
        >
          <div className={`${ui["base-component"]}`}>
            <button
              className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]}`}
              aria-label="キャンセル"
              disabled={isSubmitting}
              onClick={requestClose}
            >
              キャンセル
            </button>
            {hasTextInput && (
              <button
                className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]}`}
                disabled={isSubmitting}
                onClick={clearForm}
              >
                フォームをクリア
              </button>
            )}
          </div>
          <div className={`${ui["base-component"]}`}>
            <button
              type="button"
              className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]}`}
              disabled={isSubmitting}
              onClick={() => {
                void openDraftPicker()
              }}
            >
              下書き
            </button>
            <button
              form="entry-form"
              className={`${ui["base-button"]} ${ui["text-button"]} ${ui["blue-button"]}`}
              type="submit"
              disabled={isSubmitting}
            >
              投稿
            </button>

            {showXIntentButton && (
              <button
                type="button"
                className={`${ui["base-button"]} ${ui["text-button"]} ${ui["black-button"]}`}
                disabled={isSubmitting}
                onClick={() => {
                  const intentText = text.trim()
                  if (!intentText) {
                    setStatus("共有する投稿本文を入力してください。")
                    setStatusColor("#b00")
                    return
                  }

                  const popupOpened = openXIntentPopup(intentText)
                  setStatus(
                    popupOpened
                      ? "x.com 投稿画面を開きました。"
                      : "x.com 投稿画面を開けませんでした。ポップアップブロックを確認してください。",
                  )
                  setStatusColor(popupOpened ? "green" : "#b00")
                }}
              >
                X投稿
              </button>
            )}
            {showTaittsuuIntentButton && (
              <button
                type="button"
                className={`${ui["base-button"]} ${ui["text-button"]} ${ui["gray-button"]}`}
                disabled={isSubmitting}
                onClick={() => {
                  const intentText = text.trim()
                  if (!intentText) {
                    setStatus("共有する投稿本文を入力してください。")
                    setStatusColor("#b00")
                    return
                  }

                  const popupOpened = openTaittsuuIntentPopup(intentText)
                  setStatus(
                    popupOpened
                      ? "タイッツー投稿画面を開きました。"
                      : "タイッツー投稿画面を開けませんでした。ポップアップブロックを確認してください。",
                  )
                  setStatusColor(popupOpened ? "green" : "#b00")
                }}
              >
                タイッツー投稿
              </button>
            )}
          </div>
        </div>

        <form
          id="entry-form"
          className={ui["dialog-body"]}
          onSubmit={handleSubmit}
        >
          <div className={styles["body-row"]}>
            <div className={styles.avatar} aria-hidden>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  className={styles["avatar-img"]}
                  alt="avatar"
                />
              ) : (
                <svg viewBox="0 0 36 36" className={styles["avatar-img"]}>
                  <circle cx="18" cy="18" r="18" fill="#e6eef9" />
                  <text
                    x="50%"
                    y="55%"
                    textAnchor="middle"
                    fontSize="14"
                    fill="#2b6cb0"
                  ></text>
                </svg>
              )}
            </div>

            <div className={styles["input-area"]}>
              <CountedTextInput
                id="text"
                name="text"
                multiline
                rows={6}
                placeholder="最近どう？"
                value={text}
                onChange={setText}
                disabled={isSubmitting}
                counters={textCounters}
              />
            </div>
          </div>
          <div
            className={`${ui.toolbar} ${ui["toolbar-align"]} ${ui["toolbar-align-between"]}`}
          >
            <SelfLabelsSelect
              value={selfLabel}
              onChange={setSelfLabel}
              disabled={isSubmitting}
            />
            <LanguageSelect
              value={languageCode}
              onChange={setLanguageCode}
              disabled={isSubmitting}
            />
          </div>

          <div
            className={`${ui.toolbar} ${ui["toolbar-align"]} ${ui["toolbar-align-left"]}`}
          >
            <ImagePicker
              ref={imagePickerRef}
              value={imageEntry}
              onChange={entry => {
                if (entry && ogpResult) {
                  setOgpResult(null)
                  ogpFetch.clearOgpStatus()
                }
                setImageEntry(entry)
              }}
              disabled={isSubmitting}
            />
            <OgpFetchButton ogpFetch={ogpFetch} disabled={isSubmitting} />
          </div>
          <div>
            <OgpPreview ogpFetch={ogpFetch} />
            <ImagePreview value={imageEntry} />
          </div>
          <div className={ui["base-component"]}>
            <Collapsible
              label="詳細オプション"
              defaultOpen={defaultOpenShareOptions}
            >
              <div className={styles["share-options"]}>
                <ToggleSwitch
                  checked={openXPopup}
                  disabled={isSubmitting || crosspostToTaittsuu}
                  label="ポップアップを利用する"
                  onCheckedChange={next => {
                    setOpenXPopup(next)
                    writeOpenPopupSetting(next)
                    if (!next) {
                      setCrosspostToTaittsuu(false)
                      writeCrosspostToTaittsuuSetting(false)
                    }
                  }}
                />
                <ToggleSwitch
                  checked={crosspostToTaittsuu}
                  disabled={isSubmitting}
                  label="タイッツーにクロスポスト"
                  onCheckedChange={next => {
                    setCrosspostToTaittsuu(next)
                    writeCrosspostToTaittsuuSetting(next)

                    if (next) {
                      setOpenXPopup(true)
                      writeOpenPopupSetting(true)
                    }
                  }}
                />
                <ToggleSwitch
                  checked={showXWhenCrosspost}
                  disabled={isSubmitting || !openXPopup}
                  label="X投稿ボタンを表示"
                  onCheckedChange={next => {
                    setShowXWhenCrosspost(next)
                    writeShowCrosspostXButtonSetting(next)

                    if (next) {
                      setOpenXPopup(true)
                      writeOpenPopupSetting(true)
                    }
                  }}
                />
              </div>
            </Collapsible>
          </div>
          <div
            id="status"
            aria-live="polite"
            className={`${ui.toolbar}`}
            style={{ color: statusColor }}
          >
            {status}
          </div>
        </form>
      </div>
    </>
  )
})

export default Component
