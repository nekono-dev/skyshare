/**
 * 返信可能ユーザー設定(threadgate)・引用許可設定(postgate)を編集するダイアログ。
 *
 * 責務と処理概要:
 * - `PostGateValue` を編集フォームとして表示し、「適用」時のみ確定値を親へ通知する
 *   （Overlayの背景クリック/Escでの誤操作コミットを避けるため、明示的なコミット方式にする）。
 * - PostForm（1回の投稿ごとの一時的な設定）と Settings（デフォルト値そのものの編集）の
 *   両方から同一コンポーネントとして再利用される。呼び出し元は `value`/`onChange` の
 *   意味づけ（一時的な作業値か、永続化するデフォルト値か）だけを使い分ける。
 * - 「誰でも返信可能」/「返信不可」はカード状のラジオボタン（`RadioButton`）で排他選択し、
 *   「メンションされた人」/「フォロワー」/「フォロー中の人」/「リストから選択」の組み合わせ
 *   （カード状チェックボックス）とは相互排他の関係にある: いずれかの組み合わせチェックが
 *   ONになるとラジオの選択は自動的に外れ（`replyAudience`が"custom"へ遷移するため）、
 *   逆にラジオを選択すると組み合わせ側は全てクリアされる。また、組み合わせ・リスト選択の
 *   チェックを全て外した結果ラジオもチェックもいずれもONでない状態になる場合は、
 *   `replyAudience`が未設定のままにならないよう「誰でも返信可能」へ自動フォールバックする。
 * - 組み合わせ用チェックボックス・リスト選択チェックボックスは、いずれも`ComponentList`
 *   （汎用リスト整列コンポーネント）でカード状(`Checkbox` variant="card")に整列し、
 *   ラジオボタンの横並び行と横幅が揃うグリッドレイアウトにする。
 * - ダイアログが開かれた時点で、自分自身のBlueskyリスト一覧を`getOwnLists`（ブラウザから
 *   直接Bluesky公開AppViewを叩く、認証不要の読み取り）で読み込んでおく。
 */
import { useEffect, useId, useRef, useState } from "react"
import Checkbox from "@/components/common/Checkbox"
import Collapsible from "@/components/common/Collapsible"
import ComponentList from "@/components/common/ComponentList"
import Overlay from "@/components/common/Overlay"
import RadioButton from "@/components/common/RadioButton"
import ToggleSwitch from "@/components/common/ToggleSwitch"
import { getOwnLists, type OwnedList } from "@/lib/atproto/lists"
import { MAX_REPLY_GATE_RULES, type PostGateValue } from "@/lib/atproto/gate"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

type Props = {
  open: boolean
  onClose: () => void
  value: PostGateValue
  onChange: (next: PostGateValue) => void
  /** リスト取得に使うアカウントDID。未解決の間は「リストから選択」を無効化する。 */
  accountDid?: string | null
  disabled?: boolean
}

type RuleField = "allowMentioned" | "allowFollower" | "allowFollowing"

/** 組み合わせ用チェックボックス（メンション/フォロワー/フォロー中）の一覧定義。 */
const RULE_ITEMS: { key: RuleField; label: string }[] = [
  { key: "allowMentioned", label: "メンションされた人" },
  { key: "allowFollower", label: "フォロワー" },
  { key: "allowFollowing", label: "フォロー中の人" },
]

/**
 * customモードにおける現在の選択合計数を数える。
 *
 * Input:
 * - `draft`: 編集中の値
 *
 * Output:
 * - 選択済みのルール数（mention/follower/following/listUrisの合計）
 */
const countSelectedRules = (draft: PostGateValue): number => {
  return (
    (draft.allowMentioned ? 1 : 0) +
    (draft.allowFollower ? 1 : 0) +
    (draft.allowFollowing ? 1 : 0) +
    draft.listUris.length
  )
}

/**
 * `ComponentList`用の、カード状チェックボックス1件分の雛形コンポーネント。
 *
 * 処理の趣旨:
 * - `getItemProps`で算出した`checked`/`disabled`/`onCheckedChange`をそのまま
 *   `Checkbox`（variant="card"）へ橋渡しするだけの薄いラッパー。
 *
 * Input:
 * - `label`: 表示ラベル
 * - `checked`/`disabled`/`onCheckedChange`: `Checkbox`にそのまま渡す値
 *
 * Output:
 * - カード状チェックボックス1件
 */
const GateCheckboxItem = ({
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  item: unknown
  label: string
  checked: boolean
  disabled: boolean
  onCheckedChange: (next: boolean) => void
}) => (
  <Checkbox
    variant="card"
    checked={checked}
    disabled={disabled}
    label={label}
    onCheckedChange={onCheckedChange}
  />
)

/**
 * 返信可能ユーザー設定・引用許可設定の編集ダイアログを描画する。
 *
 * Input:
 * - `open`: ダイアログの表示状態
 * - `onClose`: キャンセル（背景クリック/Esc/キャンセルボタン共通）
 * - `value`: ダイアログを開くたびの初期値
 * - `onChange`: 「適用」ボタン押下時に確定値を渡すコールバック
 * - `accountDid`: リスト取得対象のDID（未解決ならリスト選択を無効化）
 * - `disabled`: true の場合、内部コントロールを操作不能にする
 *
 * Output:
 * - `open=false` の場合は何も描画しない
 * - `open=true` の場合、返信可能ユーザー・引用許可を編集できるダイアログ
 *
 * 例:
 * - 入力: `{ open: true, value: DEFAULT_POST_GATE_VALUE, onChange, onClose }`
 * - 出力: 「誰でも返信可能」「引用を許可する」がONの初期状態で開いたダイアログ
 */
export const PostGateDialog = ({
  open,
  onClose,
  value,
  onChange,
  accountDid,
  disabled = false,
}: Props) => {
  const radioGroupName = useId()
  const [draft, setDraft] = useState<PostGateValue>(value)
  const [lists, setLists] = useState<OwnedList[] | null>(null)
  const [listsLoading, setListsLoading] = useState(false)
  const [listsError, setListsError] = useState<string | null>(null)
  // 一度リスト取得を試みたかどうかをrefで管理する。
  // 取得の成否（lists/listsLoading）をuseEffectの依存配列に含めると、
  // エフェクト内で更新したstateがそのままエフェクトの再実行トリガーとなり、
  // 実行中のPromiseに対する`cancelled`フラグが完了前に真になってしまう
  // （setListsLoading(true)由来の再実行でcleanupが即座に走り、その後の
  // .then/.finallyがcancelled判定でスキップされ「読み込み中」から進まなくなる）。
  // このrefはエフェクトの再実行トリガーにしないことで、この無限ループを避ける。
  const listsRequestedRef = useRef(false)

  // ダイアログを開くたびに前回のキャンセル/適用内容を引きずらず、渡された値で同期する。
  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])

  // ダイアログが開かれた時点でリスト一覧を読み込んでおく（要件: 開かれたら読み込む）。
  // 一度取得を試みていれば（listsRequestedRef.current）、同一マウント中は再試行しない
  // （失敗時のみ再度開いたときにリトライできるようrefを戻す）。
  useEffect(() => {
    if (!open || !accountDid || listsRequestedRef.current) return
    listsRequestedRef.current = true

    let cancelled = false
    setListsLoading(true)
    setListsError(null)
    getOwnLists(accountDid)
      .then(result => {
        if (!cancelled) setLists(result)
      })
      .catch(err => {
        console.error("PostGateDialog: failed to load lists", err)
        if (!cancelled) {
          setListsError("リスト一覧の取得に失敗しました。")
          listsRequestedRef.current = false
        }
      })
      .finally(() => {
        if (!cancelled) setListsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, accountDid])

  const selectedCount = countSelectedRules(draft)

  /**
   * 「誰でも返信可能」/「返信不可」ラジオが選択された時のハンドラ。
   *
   * 処理の趣旨:
   * - ラジオが選択されたら、組み合わせ用の全フラグ・リスト選択をクリアする
   *   （ラジオと組み合わせチェックボックスは相互排他のため）。
   *
   * Input:
   * - `next`: 選択されたラジオの値
   */
  const selectReplyAudience = (next: "everyone" | "nobody") => {
    setDraft(prev => ({
      ...prev,
      replyAudience: next,
      allowMentioned: false,
      allowFollower: false,
      allowFollowing: false,
      listUris: [],
    }))
  }

  /**
   * 組み合わせ用チェックボックス（メンション/フォロワー/フォロー中）の切り替えハンドラ。
   *
   * 処理の趣旨:
   * - ONにした場合、`replyAudience`を"custom"へ自動遷移させる
   *   （ラジオと組み合わせチェックボックスは相互排他のため、これによりラジオの選択が外れる）。
   * - OFFにした結果、組み合わせ・リスト選択が全て解除された状態になった場合は、
   *   `replyAudience`が未設定のままにならないよう「誰でも返信可能」へフォールバックする。
   *
   * Input:
   * - `field`: 切り替え対象のフラグ名
   * - `checked`: 切り替え後の値
   */
  const toggleRule = (field: RuleField, checked: boolean) => {
    setDraft(prev => {
      const next = { ...prev, [field]: checked }
      const allCleared =
        !next.allowMentioned &&
        !next.allowFollower &&
        !next.allowFollowing &&
        next.listUris.length === 0
      return {
        ...next,
        replyAudience: checked
          ? "custom"
          : allCleared
            ? "everyone"
            : prev.replyAudience,
      }
    })
  }

  /**
   * リストのチェック状態を切り替える。
   *
   * OFFにした結果、組み合わせ・リスト選択が全て解除された状態になった場合は、
   * `replyAudience`が未設定のままにならないよう「誰でも返信可能」へフォールバックする。
   *
   * Input:
   * - `uri`: 対象リストのAT-URI
   * - `checked`: 切り替え後のチェック状態
   */
  const toggleList = (uri: string, checked: boolean) => {
    setDraft(prev => {
      const listUris = checked
        ? [...prev.listUris, uri]
        : prev.listUris.filter(u => u !== uri)
      const allCleared =
        !prev.allowMentioned &&
        !prev.allowFollower &&
        !prev.allowFollowing &&
        listUris.length === 0
      return {
        ...prev,
        listUris,
        replyAudience: checked
          ? "custom"
          : allCleared
            ? "everyone"
            : prev.replyAudience,
      }
    })
  }

  const handleApply = () => {
    onChange(draft)
  }

  return (
    <Overlay open={open} onClose={onClose} contentClassName={ui["width-sm"]}>
      <div
        className={`${ui["base-card"]} ${ui["dialog-card"]} ${ui["base-padding"]}`}
        role="dialog"
        aria-label="返信・引用の設定"
        style={{ maxHeight: "80vh", overflow: "auto" }}
      >
        <h2 className={ui.subject}>返信・引用の設定</h2>

        <div className={ui["dialog-body"]}>
          <div className={styles["radio-row"]}>
            <RadioButton
              checked={draft.replyAudience === "everyone"}
              disabled={disabled}
              label="誰でも返信可能"
              name={radioGroupName}
              onSelect={() => selectReplyAudience("everyone")}
            />
            <RadioButton
              checked={draft.replyAudience === "nobody"}
              disabled={disabled}
              label="返信不可"
              name={radioGroupName}
              onSelect={() => selectReplyAudience("nobody")}
            />
          </div>

          <div className={styles["rule-group"]}>
            <ComponentList
              items={RULE_ITEMS}
              itemComponent={GateCheckboxItem}
              getItemKey={item => item.key}
              getItemProps={item => ({
                label: item.label,
                checked: draft[item.key],
                disabled,
                onCheckedChange: (next: boolean) => toggleRule(item.key, next),
              })}
              className={styles["checkbox-grid"]}
            />

            <Collapsible
              label="リストから選択"
              defaultOpen={draft.listUris.length > 0}
              disabled={disabled || !accountDid}
            >
              <div className={styles["list-panel"]}>
                {listsLoading && <p>リストを読み込み中...</p>}
                {listsError && (
                  <p className={styles["list-error"]}>{listsError}</p>
                )}
                {!listsLoading && !listsError && lists?.length === 0 && (
                  <p className={styles.note}>リストがありません。</p>
                )}
                {!listsLoading && !listsError && lists && lists.length > 0 && (
                  <ComponentList
                    items={lists}
                    itemComponent={GateCheckboxItem}
                    getItemKey={item => item.uri}
                    getItemProps={item => {
                      const checked = draft.listUris.includes(item.uri)
                      const atLimit = selectedCount >= MAX_REPLY_GATE_RULES
                      return {
                        label: item.name,
                        checked,
                        disabled: disabled || (!checked && atLimit),
                        onCheckedChange: (next: boolean) =>
                          toggleList(item.uri, next),
                      }
                    }}
                    className={styles["checkbox-grid"]}
                  />
                )}
              </div>
            </Collapsible>

            {selectedCount >= MAX_REPLY_GATE_RULES && (
              <p className={styles.note}>
                最大{MAX_REPLY_GATE_RULES}件まで選択できます。
              </p>
            )}
          </div>

          <ToggleSwitch
            checked={draft.allowQuote}
            disabled={disabled}
            label="引用を許可する"
            onCheckedChange={next =>
              setDraft(prev => ({ ...prev, allowQuote: next }))
            }
          />
        </div>

        <div className={`${ui["dialog-actions"]} ${ui["dialog-actions-row"]}`}>
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["text-button"]} ${ui["gray-button"]}`}
            disabled={disabled}
            onClick={onClose}
          >
            キャンセル
          </button>
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["text-button"]} ${ui["blue-button"]}`}
            disabled={disabled}
            onClick={handleApply}
          >
            適用
          </button>
        </div>
      </div>
    </Overlay>
  )
}

export default PostGateDialog
