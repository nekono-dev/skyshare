/**
 * 投稿フォームコンポーネント。
 *
 * 責務と処理概要:
 * - テキスト投稿・画像投稿・OGP 投稿の入力状態を管理する。
 * - 送信時に OpenAPI 契約へ整形し、`createEntry` API を呼び出す。
 * - 画像投稿では不足しうる `imagesMeta` を補完して送信する。
 */
import React, { useEffect, useState } from "react"
import twitterText from "twitter-text"
import { createEntry } from "@/client/openapi/client"
import type { CreateEntryBody } from "@/client/openapi/model"
import type { CreateEntryBodySelfLabels } from "@/client/openapi/model"
import Collapsible from "@/components/Collapsible/index"
import ImagePicker, { type ImageEntry } from "@/components/ImagePicker"
import ImagePreview from "@/components/ImagePreview"
import LanguageSelect from "@/components/LanguageSelect"
import Loading from "@/components/Loading"
import OgpFetchButton, { type OgpResult } from "@/components/OgpFetchButton"
import SelfLabelsSelect from "@/components/SelfLabelsSelect"
import ToggleSwitch from "@/components/ToggleSwitch"
import {
  readCrosspostToTaittsuuSetting,
  readOpenPopupSetting,
  readShowCrosspostXButtonSetting,
  writeCrosspostToTaittsuuSetting,
  writeOpenPopupSetting,
  writeShowCrosspostXButtonSetting,
} from "@/lib/shareSettings"
import {
  buildTaittsuuIntentText,
  openTaittsuuIntentPopup,
} from "@/lib/taittsuuIntent"
import { canShareWithWebApi, shareWithWebApi } from "@/lib/webShare"
import { buildXIntentText, openXIntentPopup } from "@/lib/xIntent"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

type Props = {
  onClose?: () => void
  onPosted?: () => void
  avatarUrl?: string | null
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
export const Component: React.FC<Props> = ({
  onClose,
  onPosted,
  avatarUrl,
}) => {
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

  const bskyMaxCount = 300
  const xWarnCount = 140

  /**
   * X.com 向けの投稿文字数を返す。
   *
   * 処理の趣旨:
   * - 旧実装 TextInputBox と同様に twitter-text の重み付きカウントを 2 で割って切り上げる。
   * - 解析失敗時は入力文字列長へフォールバックする。
   *
   * Input:
   * - `rawText`: 投稿入力文字列
   *
   * Output:
   * - X.com 換算の投稿文字数
   *
   * 例:
   * - 入力: "hello"
   * - 出力: 5
   */
  const countTextOnX = (rawText: string): number => {
    try {
      return Math.ceil(twitterText.parseTweet(rawText).weightedLength / 2)
    } catch {
      return rawText.length
    }
  }

  /**
   * Bluesky 向けの投稿文字数を返す。
   *
   * 処理の趣旨:
   * - 絵文字などの結合文字を過大評価しないよう grapheme 単位でカウントする。
   * - Intl.Segmenter 非対応環境では文字列長へフォールバックする。
   *
   * Input:
   * - `rawText`: 投稿入力文字列
   *
   * Output:
   * - Bluesky 換算の投稿文字数
   *
   * 例:
   * - 入力: "☕️"
   * - 出力: 1
   */
  const countTextOnBsky = (rawText: string): number => {
    try {
      const segmenterJa = new Intl.Segmenter("ja-JP", {
        granularity: "grapheme",
      })
      return Array.from(segmenterJa.segment(rawText)).length
    } catch {
      return rawText.length
    }
  }

  const textCountOnX = countTextOnX(text)
  const textCountOnBsky = countTextOnBsky(text)
  const charCountAlertClass =
    textCountOnBsky > bskyMaxCount
      ? styles.charCountError
      : textCountOnX > xWarnCount && textCountOnBsky <= bskyMaxCount
        ? styles.charCountWarn
        : ""
  const showXIntentButton = openXPopup && showXWhenCrosspost
  const showTaittsuuIntentButton = openXPopup && crosspostToTaittsuu
  const hasTextInput = text.trim().length > 0
  const defaultOpenShareOptions = resolveShareOptionsDefaultOpen({
    openXPopup,
    crosspostToTaittsuu,
    showXWhenCrosspost,
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
      const payload: CreateEntryBody = {
        text,
        langs: [languageCode],
        selfLabels: selfLabel,
      }

      if (imageEntry) {
        payload.ogImage = imageEntry.thumbnailBlob
        payload.images = imageEntry.originalBlobs
        payload.imagesMeta = await resolveImageMetadata(imageEntry)
      } else if (ogpResult) {
        payload.ogMeta = ogpResult.meta
        payload.ogImage = ogpResult.imageBlob
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

      setStatusColor("green")
      onPosted?.()
      const shareText = buildXIntentText(text, res.data.skyshare.uri)
      const taittsuuIntentText = buildTaittsuuIntentText(
        text,
        res.data.skyshare.uri,
      )

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
    <div className={`${ui.baseCard}`} role="dialog" aria-label="投稿フォーム">
      {isSubmitting && <Loading overlay message="投稿中..." />}
      <div
        className={`${ui.toolbar} ${ui.toolbarAlign} ${ui.toolbarAlignBetween}`}
      >
        <div className={`${ui.baseComponent}`}>
          <button
            className={`${ui.baseButton} ${ui.textButton} ${ui.whiteButton}`}
            aria-label="キャンセル"
            disabled={isSubmitting}
            onClick={() => {
              if (onClose) onClose()
            }}
          >
            キャンセル
          </button>
          {hasTextInput && (
            <button
              className={`${ui.baseButton} ${ui.textButton} ${ui.whiteButton}`}
              disabled={isSubmitting}
              onClick={clearForm}
            >
              フォームをクリア
            </button>
          )}
        </div>
        <div className={`${ui.baseComponent}`}>
          <button
            className={`${ui.baseButton} ${ui.textButton} ${ui.whiteButton}`}
            disabled={isSubmitting}
          >
            下書き
          </button>
          <button
            form="entry-form"
            className={`${ui.baseButton} ${ui.textButton} ${ui.blueButton}`}
            type="submit"
            disabled={isSubmitting}
          >
            投稿
          </button>

          {showXIntentButton && (
            <button
              type="button"
              className={`${ui.baseButton} ${ui.textButton} ${ui.blackButton}`}
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
              className={`${ui.baseButton} ${ui.textButton} ${ui.grayButton}`}
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

      <form id="entry-form" className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.bodyRow}>
          <div className={styles.avatar} aria-hidden>
            {avatarUrl ? (
              <img src={avatarUrl} className={styles.avatarImg} alt="avatar" />
            ) : (
              <svg viewBox="0 0 36 36" className={styles.avatarImg}>
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

          <div className={styles.inputArea}>
            <textarea
              className={styles.textarea}
              id="text"
              name="text"
              rows={6}
              placeholder="最近どう？"
              value={text}
              onChange={e => setText(e.target.value)}
              disabled={isSubmitting}
            />
            <div
              className={`${ui.toolbar} ${ui.toolbarAlign} ${ui.toolbarAlignRight}`}
            >
              <div
                className={[styles.charCount, charCountAlertClass]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span style={{ whiteSpace: "nowrap" }}>
                  {textCountOnX}/{xWarnCount}:X
                </span>
                <span style={{ minWidth: "9.5rem", textAlign: "right" }}>
                  {textCountOnBsky}/{bskyMaxCount}:Bluesky
                </span>
              </div>
            </div>
          </div>
        </div>
        <div
          className={`${ui.toolbar} ${ui.toolbarAlign} ${ui.toolbarAlignBetween}`}
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
          className={`${ui.toolbar} ${ui.toolbarAlign} ${ui.toolbarAlignBetween}`}
        >
          <OgpFetchButton
            text={text}
            value={ogpResult}
            onChange={nextOgp => {
              if (nextOgp) {
                setImageEntry(prevImageEntry => {
                  revokeImageEntry(prevImageEntry)
                  return null
                })
              }
              setOgpResult(nextOgp)
            }}
            disabled={isSubmitting}
          />
          <ImagePicker
            value={imageEntry}
            onChange={entry => {
              if (entry && ogpResult) {
                setOgpResult(null)
              }
              setImageEntry(entry)
            }}
            disabled={isSubmitting}
          />
        </div>
        <div>
          <ImagePreview value={imageEntry} />
        </div>
        <div className={ui.baseComponent}>
          <Collapsible
            label="詳細オプション"
            defaultOpen={defaultOpenShareOptions}
          >
            <div className={`${ui.toolbar}`}>
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
  )
}

export default Component
