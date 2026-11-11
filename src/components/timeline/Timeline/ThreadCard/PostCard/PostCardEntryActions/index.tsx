/**
 * PostCard の Entry 作成・削除とクロスポストの操作を表示する。
 * クロスポストは Entry の有無にかかわらず表示し、Entry がなければ URL なしで共有する。
 */
import type { PlainMessageKey } from "@/lib/i18n/translate"
import { useT } from "@/components/i18n/useTranslation"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"
import type { SkyshareEntryDisplayState } from "@/components/timeline/Timeline/ThreadCard/PostCard/PostCardEntryActions/useSkyshareEntryStatus"
import crosspostIcon from "@/images/crosspost.svg"

type Props = {
  display: SkyshareEntryDisplayState
  createError: PlainMessageKey | null
  deleteError: PlainMessageKey | null
  onCreate: () => void
  onRequestDelete: () => void
  onCrosspost: () => void
  /**
   * true の場合、Bluesky への書き込みを伴う Entry 作成を無効化する。
   * X 共有ダイアログは atproto 認証を使わないため無効化しない。
   */
  disabled?: boolean
  /** trueの場合、削除ボタンのみ無効化する（削除範囲の判定中など。ゲスト表示では削除を有効にするため`disabled`と分ける） */
  deleteDisabled?: boolean
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
 * - クロスポストのボタンと、`display.kind` に応じたボタン（作成・削除。作成対象外は表示なし）
 *
 * 例:
 * - 入力: `display={{ kind: "creatable" }}`
 * - 出力: クロスポストのボタンと「Skyshare Entryを作成」ボタン
 */
const Component = ({
  display,
  createError,
  deleteError,
  onCreate,
  onRequestDelete,
  onCrosspost,
  disabled = false,
  deleteDisabled = false,
}: Props) => {
  const { t } = useT()
  return (
    <>
      <button
        type="button"
        className={`${ui["base-button"]} ${ui["nontext-button"]} ${ui["md-button"]} ${ui["white-button"]}`}
        disabled={display.kind === "creating"}
        onClick={onCrosspost}
        aria-label={t("post.entryActions.crosspost")}
        title={t("post.entryActions.crosspost")}
      >
        <img src={crosspostIcon.src} width={20} height={20} alt="" />
      </button>

      {display.kind === "entry" || display.kind === "deleting" ? (
        <button
          type="button"
          className={`${ui["base-button"]} ${ui["text-button"]} ${ui["red-button"]}`}
          disabled={deleteDisabled || display.kind === "deleting"}
          onClick={onRequestDelete}
        >
          {t("post.entryActions.deletePost")}
        </button>
      ) : display.kind === "creatable" || display.kind === "creating" ? (
        <button
          type="button"
          className={`${ui["base-button"]} ${ui["text-button"]} ${ui["blue-button"]}`}
          disabled={disabled || display.kind === "creating"}
          onClick={onCreate}
        >
          {display.kind === "creating"
            ? t("post.entryActions.creating")
            : t("post.entryActions.create")}
        </button>
      ) : null}

      {createError ? (
        <span className={styles["create-entry-error"]}>{t(createError)}</span>
      ) : null}

      {deleteError ? (
        <span className={styles["create-entry-error"]}>{t(deleteError)}</span>
      ) : null}
    </>
  )
}

export default Component
