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
import { RichText } from "@atproto/api"
import {
  createDraft,
  deleteDraft,
  getDrafts,
  updateDraft,
} from "@/client/openapi/client"
import Avatar from "@/components/common/Avatar"
import Collapsible from "@/components/common/Collapsible/index"
import { type CounterSpec } from "@/components/common/CountedTextInput"
import DraftListPanel from "@/components/entry/DraftListPanel"
import DraftSaveConfirmDialog from "@/components/entry/DraftSaveConfirmDialog"
import ImagePicker, {
  type ImageEntry,
  type ImagePickerHandle,
} from "@/components/image/ImagePicker"
import ImagePreview from "@/components/image/ImagePreview"
import InlineIcon from "@/components/common/InlineIcon"
import LanguageSelect from "@/components/common/LanguageSelect"
import Loading from "@/components/common/Loading"
import {
  OgpFetchButton,
  useOgpFetch,
  type OgpResult,
} from "@/components/image/OgpFetchButton"
import OgpPreview from "@/components/image/OgpPreview"
import Overlay from "@/components/common/Overlay"
import PostBodyEditor from "./PostBodyEditor"
import PostGateDialog from "@/components/post/PostGateDialog"
import SelfLabelsSelect from "@/components/post/SelfLabelsSelect"
import SuggestPopover from "@/components/post/SuggestPopover"
import ToggleSwitch from "@/components/common/ToggleSwitch"
import { useSuggest } from "./useSuggest"
import { extractTagsFromFacets } from "@/lib/atproto/richtext"
import { DEFAULT_POST_GATE_VALUE, type PostGateValue } from "@/lib/atproto/gate"
import { addHashtagsToHistory } from "@/lib/settings/hashtagHistorySettings"
import { normalizeDraftList } from "@/lib/entry/draftList"
import type { CreateEntryBodySelfLabels } from "@/client/openapi/model"
import {
  isDefaultPostGateValue,
  readPostGateDefaultSetting,
  readSyncGateDefaultAfterPostSetting,
  writePostGateDefaultSetting,
  writeSyncGateDefaultAfterPostSetting,
} from "@/lib/settings/postGateSettings"
import {
  readPinnedFormDisabledSetting,
  writePinnedFormDisabledSetting,
} from "@/lib/settings/shareSettings"
import {
  readHashtagSuggestEnabledSetting,
  readMentionSuggestEnabledSetting,
} from "@/lib/settings/suggestSettings"
import { buildIntentText, openIntentPopupFor } from "@/util/share/intent"
import { preOpenPopupWindow } from "@/util/share/openIntentPopup"
import { countGraphemes, countWeightedTweetLength } from "@/util/textCount"
import { runShareDispatch } from "./shareDispatch"
import { submitEntry } from "./submitEntry"
import { useKeyboardRows } from "./useKeyboardRows"
import { useShareToggles } from "@/lib/settings/useShareToggles"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

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
  /** ハッシュタグ履歴（`hashtagHistorySettings.ts`）をアカウント別に分けるための識別子 */
  accountDid?: string | null
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
 * 投稿確定後、本文中のハッシュタグをローカル履歴（`hashtagHistorySettings.ts`）へ記録する。
 *
 * 処理の趣旨:
 * - 候補機能（`useSuggest`）のハッシュタグ候補は、Bluesky公開APIのグローバルなトレンドだけでは
 *   賄えないため、このブラウザで過去に自分が使ったタグを補う目的でここに記録する。
 * - facet抽出に失敗しても投稿フロー自体は継続させたいため、例外を握りつぶす。
 *
 * Input:
 * - `text`: 投稿本文
 * - `accountDid`: 履歴を分離するアカウントの識別子。未解決なら記録しない
 *
 * Output:
 * - なし（localStorageへの副作用のみ）
 */
const recordUsedHashtagsToHistory = (
  text: string,
  accountDid: string | null | undefined,
) => {
  try {
    const rt = new RichText({ text })
    rt.detectFacetsWithoutResolution()
    const tags = extractTagsFromFacets(rt.facets)
    addHashtagsToHistory(tags, accountDid)
  } catch (err) {
    console.warn("PostForm: failed to record hashtag history", err)
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
    accountDid,
    onPinnedFormDisabledChange,
  },
  ref,
) {
  const [text, setText] = useState("")
  const [languageCode, setLanguageCode] = useState("ja")
  const shareToggles = useShareToggles()
  // useShareToggles はハイドレーション不一致を避けるため、マウント直後は
  // 共有系トグルを全てfalse固定で返し、実際の値はマウント後のuseEffectで非同期に
  // 反映する。Collapsible の defaultOpen は初回マウント時のみ評価される
  // （内部 state の初期化関数のため）ので、そのままでは常にfalseの仮値を見て
  // 折りたたんだ状態になってしまう。トグルの読み込み完了を検知して
  // Collapsible の key を変えることで、正しい値が揃った時点で再マウント
  // させ、defaultOpen を正しく再評価させる。
  const [shareTogglesReady, setShareTogglesReady] = useState(false)
  useEffect(() => {
    setShareTogglesReady(true)
  }, [])
  const [pinnedFormDisabled, setPinnedFormDisabled] = useState(() =>
    readPinnedFormDisabledSetting(false),
  )
  const [hashtagSuggestEnabled] = useState(() =>
    readHashtagSuggestEnabledSetting(true),
  )
  const [mentionSuggestEnabled] = useState(() =>
    readMentionSuggestEnabledSetting(true),
  )

  const [selfLabel, setSelfLabel] = useState<
    CreateEntryBodySelfLabels | undefined
  >(undefined)
  const [postGate, setPostGate] = useState<PostGateValue>(
    DEFAULT_POST_GATE_VALUE,
  )
  const [postGateDialogOpen, setPostGateDialogOpen] = useState(false)
  const [syncGateDefaultAfterPost, setSyncGateDefaultAfterPost] = useState(() =>
    readSyncGateDefaultAfterPostSetting(false),
  )
  // マウント時、および astro:page-load（View Transitions遷移でDOM/Reactインスタンスが
  // 再マウントされずに使い回された場合）のたびに、返信・引用設定のデフォルト値・
  // 同期トグルをlocalStorageから読み直す。「画面を開いた時は常に最後に編集された
  // デフォルト値」を実現するための再読込であり、`Settings`コンポーネントの
  // reloadRefパターンと同じ趣旨。
  useEffect(() => {
    const reload = () => {
      setPostGate(readPostGateDefaultSetting())
      setSyncGateDefaultAfterPost(readSyncGateDefaultAfterPostSetting(false))
    }
    reload()
    document.addEventListener("astro:page-load", reload)
    return () => document.removeEventListener("astro:page-load", reload)
  }, [])
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
  const entryFormRef = useRef<HTMLFormElement>(null)
  const inputAreaRef = useRef<HTMLDivElement>(null)
  const toolboxRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  const suggest = useSuggest({
    text,
    onReplaceText: setText,
    editorRef,
    disabled: isSubmitting,
    hashtagSuggestEnabled,
    mentionSuggestEnabled,
    accountDid,
  })

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
  // クロスポスト先のトグル（taittsuu/mastodon）がONでもNoAutoPopupAfterPost OFF
  // （＝当該SNSへ自動ポップアップ中）の間はボタン表示は不要な点に注意。
  const showXIntentButton =
    shareToggles.showXWhenCrosspost && shareToggles.noAutoPopupAfterPost
  const showTaittsuuIntentButton =
    shareToggles.crosspostToTaittsuu && shareToggles.noAutoPopupAfterPost
  const showMastodonIntentButton =
    shareToggles.crosspostToMastodon && shareToggles.noAutoPopupAfterPost
  const hasTextInput = text.trim().length > 0
  // page表示でのautoGrow上限行数。ソフトウェアキーボードが表示されないプラットフォーム
  // (PC等)では、page表示のフォーカス時rows・dialog表示の固定rowsとしても使う。
  const pageMaxRows = 7
  const pageMinRows = 3
  // モバイル幅で本文欄をフォーカスした際にソフトウェアキーボードの残り領域へ
  // rowsを合わせるフック。dialog（PostLauncherのモーダル）のみで有効化する
  // （`enabled: true`）。page（常時表示フォーム）はフォーカス/ブラーに連動した
  // リサイズを行うとクリック位置とボタン位置のずれ（フォーカスずれ）を招くため無効化し
  // （`enabled: false`）、サイズ変更は本文量に応じたautoGrowのみに委ねる。
  // defaultRows がテキストボックスのサイズ調整の上限値
  const {
    rows: keyboardRows,
    keyboardMaxRows,
    handleTextareaFocus,
    handleTextareaBlur,
    isKeyboardPlatform,
  } = useKeyboardRows({
    formRef,
    inputAreaRef,
    toolboxRef,
    defaultRows: 12,
    minRows: pageMinRows,
    nonKeyboardFixedRows: pageMaxRows,
    persistToStorage: variant === "dialog",
    enabled: variant === "dialog",
  })
  // dialog表示(PostLauncherのモーダル)はOverlay内でダイアログごとスクロールする構造のため、
  // 固定rows（内部スクロール）のままにする。page表示のみ、本文欄の高さ変更を
  // 入力内容に応じたautoGrowで行う。
  const autoGrowText = variant === "page"
  const defaultOpenShareOptions = resolveShareOptionsDefaultOpen({
    optionsList: [
      shareToggles.popupIntentInsteadOfWebshare,
      shareToggles.crosspostToTaittsuu,
      shareToggles.showXWhenCrosspost,
      shareToggles.crosspostToMastodon,
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
   * 本文欄フォーカス中、Ctrl(Windows/Linux) または Cmd(Mac) + Enter で投稿を実行する。
   *
   * Input:
   * - `e`: keydown イベント
   *
   * Output:
   * - なし（フォームの送信をトリガー）
   */
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    entryFormRef.current?.requestSubmit()
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

    // 投稿API呼び出し（下のawait）を挟んでからwindow.openすると、iOS Safariでは
    // ユーザーアクティベーションが失効気味になり、実際にはポップアップが開いて
    // いるのに戻り値だけ`false`扱いになりフォールバック（ボタン表示）が誤って
    // 走ることがある。そのため自動ポップアップが行われる設定の場合は、ここ
    // （ユーザー操作と同期的なコールスタック内）で先に空のポップアップを開いて
    // おき、URL確定後にrunShareDispatch内でそこへ遷移させる。
    const willAutoPopup =
      !shareToggles.noAutoPopupAfterPost &&
      (shareToggles.crosspostToTaittsuu ||
        shareToggles.crosspostToMastodon ||
        shareToggles.popupIntentInsteadOfWebshare)
    const popupWindow = willAutoPopup ? preOpenPopupWindow() : null

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
        postGate,
      })

      if (!entryResult.ok) {
        popupWindow?.close()
        setStatusColor("#b00")
        setStatus(entryResult.message)
        return
      }

      // 「投稿後にデフォルト値を更新する」がONなら今回使った設定を新しいデフォルトとして
      // 永続化し、OFFなら保存済みのデフォルト値へ都度リセットする。トグルをその場で
      // 操作した直後に投稿しても即座に反映されるよう、都度読み直さずstateを直接参照する。
      if (syncGateDefaultAfterPost) {
        writePostGateDefaultSetting(postGate)
      } else {
        setPostGate(readPostGateDefaultSetting())
      }

      if (loadedDraft) {
        void deleteDraftSilently(loadedDraft.id)
        setLoadedDraft(null)
      }

      recordUsedHashtagsToHistory(text, accountDid)

      const dispatch = await runShareDispatch({
        text,
        skyshareUri: entryResult.skyshareUri,
        linkCardUrl: ogpResult?.sourceUrl ?? "",
        imageEntry,
        manualImageAttach: shareToggles.manualImageAttach,
        crosspostToTaittsuu: shareToggles.crosspostToTaittsuu,
        crosspostToMastodon: shareToggles.crosspostToMastodon,
        mastodonInstanceDomain: shareToggles.mastodonInstanceDomain,
        popupIntentInsteadOfWebshare: shareToggles.popupIntentInsteadOfWebshare,
        noAutoPopupAfterPost: shareToggles.noAutoPopupAfterPost,
        popupWindow,
      })

      onPosted?.()

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
      if (entryResult.gateWarning) {
        setStatus(
          `${dispatch.status}(返信・引用設定の反映に失敗した可能性があります)`,
        )
        setStatusColor("#b00")
      } else {
        setStatus(dispatch.status)
        setStatusColor(dispatch.statusColor)
      }
    } catch (err) {
      popupWindow?.close()
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
                  const intentText = buildIntentText(
                    text,
                    "",
                    ogpResult?.sourceUrl,
                  )
                  if (!intentText) {
                    setStatus("共有する投稿本文を入力してください。")
                    setStatusColor("#b00")
                    return
                  }

                  const popupOpened = openIntentPopupFor("x", intentText)
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
                  const intentText = buildIntentText(
                    text,
                    "",
                    ogpResult?.sourceUrl,
                  )
                  if (!intentText) {
                    setStatus("共有する投稿本文を入力してください。")
                    setStatusColor("#b00")
                    return
                  }

                  const popupOpened = openIntentPopupFor("taittsuu", intentText)
                  setStatus(
                    popupOpened
                      ? "タイッツー投稿画面を開きました。"
                      : "タイッツー投稿画面を開けませんでした。ポップアップブロックを確認してください。",
                  )
                  setStatusColor(popupOpened ? "green" : "#b00")
                }}
              >
                <InlineIcon name="taittsuu" />
                投稿
              </button>
            )}
            {showMastodonIntentButton && (
              <button
                type="button"
                className={`${ui["base-button"]} ${ui["text-button"]} ${ui["gray-button"]}`}
                disabled={isSubmitting}
                onClick={() => {
                  const intentText = buildIntentText(
                    text,
                    "",
                    ogpResult?.sourceUrl,
                  )
                  if (!intentText) {
                    setStatus("共有する投稿本文を入力してください。")
                    setStatusColor("#b00")
                    return
                  }

                  const popupOpened = openIntentPopupFor(
                    "mastodon",
                    intentText,
                    { instanceDomain: shareToggles.mastodonInstanceDomain },
                  )
                  setStatus(
                    popupOpened
                      ? "Mastodon投稿画面を開きました。"
                      : "Mastodon投稿画面を開けませんでした。ポップアップブロックを確認してください。",
                  )
                  setStatusColor(popupOpened ? "green" : "#b00")
                }}
              >
                <InlineIcon name="mastodon" />
                投稿
              </button>
            )}
          </div>
        </div>

        <form
          id="entry-form"
          ref={entryFormRef}
          className={ui["dialog-body"]}
          onSubmit={handleSubmit}
        >
          <div className={styles["body-row"]}>
            <Avatar
              src={avatarUrl}
              alt="avatar"
              aria-hidden
              size="md"
              className={styles.avatar}
            />

            <div className={styles["input-area"]} ref={inputAreaRef}>
              <PostBodyEditor
                rows={
                  keyboardRows ??
                  (variant === "page"
                    ? pageMinRows
                    : isKeyboardPlatform
                      ? 6
                      : pageMaxRows)
                }
                maxRows={
                  autoGrowText && variant === "page"
                    ? Math.max(pageMaxRows, keyboardMaxRows ?? pageMaxRows)
                    : undefined
                }
                autoGrow={autoGrowText}
                placeholder="最近どう？"
                value={text}
                onChange={setText}
                onFocus={handleTextareaFocus}
                onBlur={() => {
                  suggest.handleBlur()
                  handleTextareaBlur()
                }}
                onKeyDown={e => {
                  suggest.handleKeyDown(e)
                  handleTextareaKeyDown(e)
                }}
                onCompositionStart={suggest.handleCompositionStart}
                onCompositionEnd={suggest.handleCompositionEnd}
                onCaretMove={suggest.handleCaretMove}
                disabled={isSubmitting}
                counters={textCounters}
                wrapperClassName={styles["text-input-wrapper"]}
                editorRef={editorRef}
              />
              <SuggestPopover
                candidates={suggest.candidates}
                activeIndex={suggest.activeIndex}
                position={suggest.position}
                listboxId={suggest.listboxId}
                onHoverIndex={suggest.onHoverIndex}
                onSelect={suggest.onSelect}
                onDismiss={suggest.close}
              />
            </div>
          </div>
          <div
            className={`${ui["base-component"]} ${ui["base-padding"]} ${ui["toolbar"]} ${ui["toolbar-align"]} ${ui["toolbar-align-between"]} ${ui["toolbar-wrap"]}`}
          >
            <button
              type="button"
              className={`${ui["base-button"]} ${ui["text-button"]} ${ui["gray-button"]} ${!isDefaultPostGateValue(postGate) ? styles["gate-button-active"] : ""}`}
              disabled={isSubmitting}
              aria-label={
                isDefaultPostGateValue(postGate)
                  ? "返信・引用の設定"
                  : "返信・引用の設定(変更有)"
              }
              onClick={() => setPostGateDialogOpen(true)}
            >
              {isDefaultPostGateValue(postGate)
                ? "返信・引用"
                : "返信・引用(変更済有)"}
            </button>
            <LanguageSelect
              value={languageCode}
              onChange={setLanguageCode}
              disabled={isSubmitting}
            />
          </div>

          <PostGateDialog
            open={postGateDialogOpen}
            onClose={() => setPostGateDialogOpen(false)}
            value={postGate}
            accountDid={accountDid}
            disabled={isSubmitting}
            onChange={next => {
              setPostGate(next)
              setPostGateDialogOpen(false)
            }}
          />

          <div
            ref={toolboxRef}
            className={`${ui["toolbar"]} ${ui["toolbar-align"]} ${ui["toolbar-align-between"]} ${ui["toolbar-wrap"]}`}
          >
            <div
              className={`${ui["toolbar"]} ${ui["toolbar-align"]} ${ui["toolbar-align-left"]} ${ui["toolbar-wrap"]} ${ui["toolbar-auto-width"]}`}
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

            <SelfLabelsSelect
              value={selfLabel}
              onChange={setSelfLabel}
              disabled={isSubmitting}
            />
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
                  <InlineIcon name="share" />
                  の代わりにポップアップ
                  <InlineIcon name="popup" />
                  を開く
                </>
              }
              onCheckedChange={
                shareToggles.onPopupIntentInsteadOfWebshareChange
              }
            />
            <ToggleSwitch
              checked={shareToggles.manualImageAttach}
              disabled={isSubmitting}
              label="画像を自分で添付する（URLを発行しない）"
              onCheckedChange={shareToggles.onManualImageAttachChange}
            />
            <ToggleSwitch
              checked={syncGateDefaultAfterPost}
              disabled={isSubmitting}
              label="投稿後に返信・引用のデフォルト設定を更新する"
              onCheckedChange={next => {
                setSyncGateDefaultAfterPost(next)
                writeSyncGateDefaultAfterPostSetting(next)
              }}
            />
          </div>

          <div className={ui["base-component"]}>
            <Collapsible
              key={shareTogglesReady ? "loaded" : "loading"}
              label="詳細オプション"
              defaultOpen={defaultOpenShareOptions}
            >
              <div className={ui["toggle-box"]}>
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
                <ToggleSwitch
                  checked={shareToggles.crosspostToTaittsuu}
                  disabled={isSubmitting}
                  label={
                    <>
                      <InlineIcon name="taittsuu" />
                      にクロスポスト
                    </>
                  }
                  onCheckedChange={shareToggles.onCrosspostToTaittsuuChange}
                />
                <ToggleSwitch
                  checked={shareToggles.crosspostToMastodon}
                  disabled={isSubmitting}
                  label={
                    <>
                      <InlineIcon name="mastodon" />
                      にクロスポスト
                    </>
                  }
                  onCheckedChange={shareToggles.onCrosspostToMastodonChange}
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
