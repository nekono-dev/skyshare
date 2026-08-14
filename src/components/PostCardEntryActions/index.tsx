/**
 * PostCard の Entry 関連アクション（作成・クロスポスト・削除）を表示する専用コンポーネント。
 *
 * 責務と処理概要:
 * - `useSkyshareEntryStatus` が返す `display` の種別だけを見てボタン種を切り替える。
 * - ボタン種の切り替え条件（entry の有無・進行中操作・作成対象外判定）は
 *   呼び出し元のフック側に一元化し、ここでは分岐しない。
 */
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"
import type { SkyshareEntryDisplayState } from "@/components/PostCard/useSkyshareEntryStatus"
import skyshareIcon from "@/images/skyshare.svg"

type Props = {
  display: SkyshareEntryDisplayState
  createError: string | null
  deleteError: string | null
  onCreate: () => void
  onDelete: () => void
  onCrosspost: () => void
}

/**
 * Entry 関連のボタン列とエラーメッセージを描画する。
 *
 * Input:
 * - `display`: 現在の表示状態
 * - `createError`/`deleteError`: 直近の操作エラーメッセージ
 * - `onCreate`/`onDelete`/`onCrosspost`: 各ボタンの押下ハンドラ
 *
 * Output:
 * - `display.kind` に応じたボタン（作成・Entryを開く+クロスポスト+削除・作成対象外）
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
  onDelete,
  onCrosspost,
}: Props) => {
  return (
    <>
      {display.kind === "entry" || display.kind === "deleting" ? (
        <>
          {display.entry.webUrl ? (
            <a
              className={`${ui.baseButton} ${ui.nontextButton} ${ui.mdButton} ${ui.whiteButton}`}
              href={display.entry.webUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Entry を開く"
              title="Entry を開く"
            >
              <img src={skyshareIcon.src} width={20} height={20} alt="" />
            </a>
          ) : null}
          <button
            type="button"
            className={`${ui.baseButton} ${ui.textButton} ${ui.grayButton}`}
            onClick={onCrosspost}
          >
            クロスポスト
          </button>
          <button
            type="button"
            className={`${ui.baseButton} ${ui.textButton} ${ui.redButton}`}
            disabled={display.kind === "deleting"}
            onClick={onDelete}
          >
            Entryを削除
          </button>
        </>
      ) : display.kind === "creatable" || display.kind === "creating" ? (
        <button
          type="button"
          className={`${ui.baseButton} ${ui.textButton} ${ui.blueButton}`}
          disabled={display.kind === "creating"}
          onClick={onCreate}
        >
          {display.kind === "creating" ? "作成中…" : "Skyshare Entryを作成"}
        </button>
      ) : (
        <span className={styles.noSkyshare}>Skyshare Entry作成対象外</span>
      )}

      {createError ? (
        <span className={styles.createEntryError}>{createError}</span>
      ) : null}

      {deleteError ? (
        <span className={styles.createEntryError}>{deleteError}</span>
      ) : null}
    </>
  )
}

export default Component
