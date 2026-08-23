/**
 * 投稿フォームコンポーネント。
 *
 * 責務と処理概要:
 * - テキスト投稿・画像投稿・OGP 投稿の入力状態を管理する。
 * - 共有系トグルの state・永続化・連動ルールは `useShareToggles`、
 *   API送信は `submitEntry`、投稿成功後のポップアップ/WebShareAPI分岐は
 *   `shareDispatch` にそれぞれ委譲し、本体は入力状態の管理とそれらの呼び出しに専念する。
 */
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import {
  createDraft,
  deleteDraft,
  getDrafts,
  updateDraft,
} from "@/client/openapi/client"
import Collapsible from "@/components/common/Collapsible/index"
import CountedTextInput, {
  type CounterSpec,
} from "@/components/common/CountedTextInput"
import DraftListPanel from "@/components/entry/DraftListPanel"
import DraftSaveConfirmDialog from "@/components/entry/DraftSaveConfirmDialog"
import ImagePicker, {
  type ImageEntry,
  type ImagePickerHandle,
} from "@/components/image/ImagePicker"
import ImagePreview from "@/components/image/ImagePreview"
import LanguageSelect from "@/components/common/LanguageSelect"
import Loading from "@/components/common/Loading"
import {
  OgpFetchButton,
  useOgpFetch,
  type OgpResult,
} from "@/components/image/OgpFetchButton"
import OgpPreview from "@/components/image/OgpPreview"
import Overlay from "@/components/common/Overlay"
import SelfLabelsSelect from "@/components/post/SelfLabelsSelect"
import ToggleSwitch from "@/components/common/ToggleSwitch"
import { normalizeDraftList } from "@/lib/entry/draftList"
import type { CreateEntryBodySelfLabels } from "@/client/openapi/model"
import {
  readPinnedFormDisabledSetting,
  writePinnedFormDisabledSetting,
} from "@/lib/settings/shareSettings"
import { openTaittsuuIntentPopup } from "@/util/share/taittsuuIntent"
import { openXIntentPopup } from "@/util/share/xIntent"
import { countGraphemes, countWeightedTweetLength } from "@/util/textCount"
import { runShareDispatch } from "./shareDispatch"
import { submitEntry } from "./submitEntry"
import { useDialogKeyboardRows } from "./useDialogKeyboardRows"
import { useShareToggles } from "@/lib/settings/useShareToggles"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"
import shareIcon from "@/images/share.svg"

type Props = {
  /**
   * "dialog": PostLauncher の Overlay に埋め込まれるモーダル表示（既定値）。
   * "page": ページに常時表示する単独フォーム（post.astro 等）。dialog専用の
   * role="dialog"/aria-labelとキャンセルボタンを省く。
   */
  variant?: "dialog" | "page"
  onClose?: () => void
  onPosted?: () => void
  avatarUrl?: string | null
  /**
   * 「投稿フォームを固定表示しない」設定が変更されたときに呼ばれる。
   * タイムライン先頭の常時表示フォームとフローティングボタン側のモーダルフォームが
   * 同一ページに同時に存在しうるため、片方での変更をもう片方の表示制御へ即時反映する用途。
   */
  onPinnedFormDisabledChange?: (next: boolean) => void
}

/**
 * 親（PostLauncher の Overlay など）から閉じ操作を要求するための命令的ハンドル。
 */
export type PostFormHandle = {
  requestClose: () => void
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
 * 共有オプション折りたたみの初期開閉状態を決める。
 *
 * 処理の趣旨:
 * - フォーム表示時点で、共有系トグルが1つでも ON なら詳細設定を開いたまま見せる。
 * - すべて OFF の場合のみ折りたたんだ状態で開始する。
 *
 * Input:
 * - `popupIntentInsteadOfWebshare`: ポップアップ利用トグル
 * - `crosspostToTaittsuu`: タイッツー連携トグル
 * - `showXWhenCrosspost`: X 投稿ボタン表示トグル
 * - `pinnedFormDisabled`: 投稿フォーム固定表示を無効化するトグル
 *
 * Output:
 * - 初回表示時に折りたたみを開くべきなら `true`
 *
 * 例:
 * - 入力: `{ popupIntentInsteadOfWebshare: false, crosspostToTaittsuu: true, showXWhenCrosspost: false, pinnedFormDisabled: false }`
 * - 出力: `true`
 */
const resolveShareOptionsDefaultOpen = ({
  optionsList,
}: {
  optionsList: boolean[]
}) => {
  return optionsList.some(Boolean)
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
  {
    variant = "dialog",
    onClose,
    onPosted,
    avatarUrl,
    onPinnedFormDisabledChange,
  },
  ref,
) {
  const [text, setText] = useState("")
  const [languageCode, setLanguageCode] = useState("ja")
  const shareToggles = useShareToggles()
  const [pinnedFormDisabled, setPinnedFormDisabled] = useState(() =>
    readPinnedFormDisabledSetting(false),
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
  const formRef = useRef<HTMLDivElement>(null)
  const inputAreaRef = useRef<HTMLDivElement>(null)
  const toolboxRef = useRef<HTMLDivElement>(null)

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

  // ボタンは自動ポップアップの代わりに手動で投稿する手段のため、
  // NoAutoPopupAfterPost が ON（自動ポップアップ抑制中）の場合のみ表示する。
  // 特にタイッツー側は、CrosspostToTaittsuu ON かつ NoAutoPopupAfterPost OFF
  // （＝Taittsuへ自動ポップアップ中）ではボタン表示は不要な点に注意。
  const showXIntentButton =
    shareToggles.showXWhenCrosspost && shareToggles.noAutoPopupAfterPost
  const showTaittsuuIntentButton =
    shareToggles.crosspostToTaittsuu && shareToggles.noAutoPopupAfterPost
  const hasTextInput = text.trim().length > 0
  // dialog表示(PostLauncherのモーダル)ではOverlay内でダイアログごとスクロールする
  // 構造になるため、本文欄の自動高さ拡張はpage表示(常駐フォーム/単独ページ)時のみ有効にする。
  const autoGrowText = variant === "page"
  // defaultRows がテキストボックスのサイズ調整の上限値
  const { rows: dialogKeyboardRows, handleTextareaFocus } =
    useDialogKeyboardRows({
      enabled: variant === "dialog",
      formRef,
      inputAreaRef,
      toolboxRef,
      defaultRows: 12,
      minRows: 2,
    })
  const defaultOpenShareOptions = resolveShareOptionsDefaultOpen({
    optionsList: [
      shareToggles.popupIntentInsteadOfWebshare,
      shareToggles.crosspostToTaittsuu,
      shareToggles.showXWhenCrosspost,
    ],
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
   * 投稿フォームの入力項目（本文・画像・OGP・下書き紐付け）のみを初期状態へ戻す。
   * status/statusColor は触らない（投稿成功メッセージ表示と両立させるため）。
   *
   * Input:
   * - なし
   *
   * Output:
   * - なし
   */
  const resetInputFields = () => {
    setText("")
    setSelfLabel(undefined)
    setImageEntry(prevImageEntry => {
      revokeImageEntry(prevImageEntry)
      return null
    })
    setOgpResult(null)
    setLoadedDraft(null)
  }

  /**
   * 「投稿後にフォームをクリアしない」設定により保持していたフォームを
   * 「クリア」ボタン押下でリセットし、ロックを解除する。
   *
   * Input:
   * - なし
   *
   * Output:
   * - なし
   */
  const handleClearAfterPost = () => {
    resetInputFields()
    setStatus(null)
    setStatusColor(undefined)
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
      const entryResult = await submitEntry({
        text,
        languageCode,
        selfLabel,
        imageEntry,
        manualImageAttach: shareToggles.manualImageAttach,
        ogpResult,
      })

      if (!entryResult.ok) {
        setStatusColor("#b00")
        setStatus(entryResult.message)
        return
      }

      if (loadedDraft) {
        void deleteDraftSilently(loadedDraft.id)
        setLoadedDraft(null)
      }
      onPosted?.()

      const dispatch = await runShareDispatch({
        text,
        skyshareUri: entryResult.skyshareUri,
        imageEntry,
        manualImageAttach: shareToggles.manualImageAttach,
        crosspostToTaittsuu: shareToggles.crosspostToTaittsuu,
        popupIntentInsteadOfWebshare: shareToggles.popupIntentInsteadOfWebshare,
        noAutoPopupAfterPost: shareToggles.noAutoPopupAfterPost,
      })

      if (dispatch.forcedShowXIntentButtonOn) {
        // onShowXWhenCrosspostChange は内部で popupIntentInsteadOfWebshare / noAutoPopupAfterPost の
        // 強制ONも行うため、onNoAutoPopupAfterPostChange は別途呼ぶ必要がない。
        shareToggles.onShowXWhenCrosspostChange(true)
      } else if (dispatch.forcedNoAutoPopupOn) {
        shareToggles.onNoAutoPopupAfterPostChange(true)
      } else if (dispatch.forcedPopupIntentInsteadOfWebshareOn) {
        shareToggles.onPopupIntentInsteadOfWebshareChange(true)
      }
      if (dispatch.textToKeep !== null) {
        setText(dispatch.textToKeep)
      } else {
        resetInputFields()
      }
      setStatus(dispatch.status)
      setStatusColor(dispatch.statusColor)
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
          className={`${ui["base-card"]} ${ui["dialog-card"]} ${ui["base-padding"]}`}
          role="dialog"
          aria-label="下書き一覧"
          style={{ maxHeight: "80vh", overflow: "hidden" }}
        >
          <div
            className={`${ui["base-component"]} ${ui["toolbar"]} ${ui["toolbar-align"]} ${ui["toolbar-align-center"]}`}
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
        ref={formRef}
        className={`${ui["base-card"]} ${ui["dialog-card"]} ${ui["base-padding"]} ${isDraggingImage ? styles["drag-over"] : ""}`}
        {...(variant === "dialog"
          ? { role: "dialog", "aria-label": "投稿フォーム" }
          : {})}
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
          className={`${ui["base-component"]} ${ui["toolbar"]} ${ui["toolbar-align"]} ${ui["toolbar-align-between"]}`}
        >
          <div className={`${ui["base-component"]}`}>
            {variant === "dialog" && (
              <button
                className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]}`}
                aria-label="キャンセル"
                disabled={isSubmitting}
                onClick={requestClose}
              >
                キャンセル
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

            <div className={styles["input-area"]} ref={inputAreaRef}>
              <CountedTextInput
                id="text"
                name="text"
                multiline
                rows={autoGrowText ? 2 : (dialogKeyboardRows ?? 6)}
                maxRows={autoGrowText ? 7 : undefined}
                autoGrow={autoGrowText}
                placeholder="最近どう？"
                value={text}
                onChange={setText}
                onFocus={handleTextareaFocus}
                disabled={isSubmitting}
                counters={textCounters}
                wrapperClassName={styles["text-input-wrapper"]}
              />
            </div>
          </div>
          <div
            className={`${ui["base-component"]} ${ui["base-padding"]} ${ui["toolbar"]} ${ui["toolbar-align"]} ${ui["toolbar-align-between"]} ${styles["label-language-row"]}`}
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
            ref={toolboxRef}
            className={`${ui["toolbar"]} ${ui["toolbar-align"]} ${ui["toolbar-align-left"]}`}
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
          <div className={`${ui["base-padding"]} ${ui["toggle-box"]}`}>
            <ToggleSwitch
              checked={pinnedFormDisabled}
              disabled={isSubmitting}
              label="投稿フォームを固定表示しない"
              onCheckedChange={next => {
                setPinnedFormDisabled(next)
                writePinnedFormDisabledSetting(next)
                onPinnedFormDisabledChange?.(next)
              }}
            />
            <ToggleSwitch
              checked={shareToggles.popupIntentInsteadOfWebshare}
              disabled={isSubmitting}
              label={
                <>
                  <img
                    src={shareIcon.src}
                    width={18}
                    height={18}
                    alt=""
                    className={styles["share-icon"]}
                  />
                  の代わりにポップアップを開く
                </>
              }
              onCheckedChange={
                shareToggles.onPopupIntentInsteadOfWebshareChange
              }
            />
            <ToggleSwitch
              checked={shareToggles.manualImageAttach}
              disabled={isSubmitting}
              label="画像を自分で添付する(SkyshareのURLを発行しない)"
              onCheckedChange={shareToggles.onManualImageAttachChange}
            />
          </div>

          <div className={ui["base-component"]}>
            <Collapsible
              label="詳細オプション"
              defaultOpen={defaultOpenShareOptions}
            >
              <div className={ui["toggle-box"]}>
                <ToggleSwitch
                  checked={shareToggles.crosspostToTaittsuu}
                  disabled={isSubmitting}
                  label="タイッツーにクロスポスト"
                  onCheckedChange={shareToggles.onCrosspostToTaittsuuChange}
                />
                <ToggleSwitch
                  checked={shareToggles.showXWhenCrosspost}
                  disabled={isSubmitting}
                  label="X投稿ボタンを表示"
                  onCheckedChange={shareToggles.onShowXWhenCrosspostChange}
                />
                <ToggleSwitch
                  checked={shareToggles.noAutoPopupAfterPost}
                  disabled={isSubmitting}
                  label="自動ポップアップをOFFにする"
                  onCheckedChange={shareToggles.onNoAutoPopupAfterPostChange}
                />
              </div>
            </Collapsible>
          </div>
          {status !== "" && status !== null && (
            <div
              id="status"
              aria-live="polite"
              className={`${ui["base-component"]} ${ui["toolbar"]}`}
              style={{ color: statusColor }}
            >
              {status}
            </div>
          )}
        </form>
      </div>
    </>
  )
})

export default Component
