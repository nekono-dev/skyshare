/**
 * PostCard の Entry 関連アクション（作成・クロスポスト・削除）を表示する専用コンポーネント。
 * 「Entryを開く」リンクは author 情報カラム側（PostCard 側）で表示するため、ここでは扱わない。
 *
 * 責務と処理概要:
 * - `useSkyshareEntryStatus` が返す `display` の種別だけを見てボタン種を切り替える。
 * - ボタン種の切り替え条件（entry の有無・進行中操作・作成対象外判定）は
 *   呼び出し元のフック側に一元化し、ここでは分岐しない。
 */
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"
import type { SkyshareEntryDisplayState } from "@/components/post/PostCard/useSkyshareEntryStatus"
import crosspostIcon from "@/images/crosspost.svg"

type Props = {
  display: SkyshareEntryDisplayState
  createError: string | null
  deleteError: string | null
  onCreate: () => void
  onRequestDelete: () => void
  onCrosspost: () => void
  /**
   * trueの場合、Bluesky投稿への実際の書き込みを伴う操作（Entry作成・削除）を無効化する。
   * クロスポスト（Xへの共有intentポップアップ）はatprotoの認証を必要としないため対象外。
   */
  disabled?: boolean
}

/**
 * Entry 関連のボタン列とエラーメッセージを描画する。
 *
 * Input:
 * - `display`: 現在の表示状態
 * - `createError`/`deleteError`: 直近の操作エラーメッセージ
 * - `onCreate`/`onRequestDelete`/`onCrosspost`: 各ボタンの押下ハンドラ
 *
 * Output:
 * - `display.kind` に応じたボタン（作成・クロスポスト+削除・作成対象外）
 *
 * 例:
 * - 入力: `display={{ kind: "creatable" }}`
 * - 出力: 「Skyshare Entryを作成」ボタン
 */
const Component = ({
  display,
  createError,
  deleteError,
  onCreate,
  onRequestDelete,
  onCrosspost,
  disabled = false,
}: Props) => {
  return (
    <>
      {display.kind === "entry" || display.kind === "deleting" ? (
        <>
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["nontext-button"]} ${ui["md-button"]} ${ui["white-button"]}`}
            onClick={onCrosspost}
            aria-label="クロスポスト"
            title="クロスポスト"
          >
            <img src={crosspostIcon.src} width={20} height={20} alt="" />
          </button>
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["text-button"]} ${ui["red-button"]}`}
            disabled={disabled || display.kind === "deleting"}
            onClick={onRequestDelete}
          >
            投稿を削除
          </button>
        </>
      ) : display.kind === "creatable" || display.kind === "creating" ? (
        <button
          type="button"
          className={`${ui["base-button"]} ${ui["text-button"]} ${ui["blue-button"]}`}
          disabled={disabled || display.kind === "creating"}
          onClick={onCreate}
        >
          {display.kind === "creating" ? "作成中…" : "Skyshare Entryを作成"}
        </button>
      ) : (
        <span className={styles["no-skyshare"]}>Skyshareリンク作成対象外</span>
      )}

      {createError ? (
        <span className={styles["create-entry-error"]}>{createError}</span>
      ) : null}

      {deleteError ? (
        <span className={styles["create-entry-error"]}>{deleteError}</span>
      ) : null}
    </>
  )
}

export default Component
