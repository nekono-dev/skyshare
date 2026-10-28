/**
 * ChoiceQuestion(選択式質問部品)。質問文と選択肢を描画し、選択の変化を通知する。
 *
 * 責務と処理概要:
 * - 種別に応じて既存の `RadioButton`(単一)と `Checkbox`(複数、card)を切り替えて描画する。
 * - 質問のまとまりは `fieldset` と `legend`。質問文がグループのラベルになる。
 * - 選択状態を内部に持たず、渡された `selectedIds` から表示を決める(制御された部品)。
 * - 操作は `nextSelection` で組み立てた一覧を `onChange` で通知する。無効の間は通知しない。
 * - グループ名は `useId` で質問ごとに生成し、同じ画面の複数の質問が干渉しない。
 * - 表示文は呼び出し側が渡した文言をそのまま表示する(i18n 辞書は持たない)。
 *
 * 純粋関数の責務:
 * - 選択の変化から、通知する次の選択の一覧を組み立てる(`nextSelection`)。
 * - 複数選択の上限により、選択肢が選べない状態かを判定する(`isChoiceLocked`)。
 * - どちらも React に依存せず、渡された選択状態を書き換えず、補正もしない。
 *   選択状態に選択肢にない識別子があっても例外を出さず、その識別子は結果に含めない。
 */
import { useId, type ReactNode } from "react"
import Checkbox from "@/components/common/Checkbox"
import RadioButton from "@/components/common/RadioButton"
import styles from "./index.module.css"

/** 選択肢 1 件。表示文は呼び出し側が選んだ文言をそのまま渡す。 */
export type ChoiceQuestionChoice = {
  /** 選択肢の識別子(質問の中で一意) */
  id: string
  /** 表示文 */
  label: ReactNode
}

/**
 * 選択の変化から、通知する次の選択の一覧を組み立てる。
 *
 * Input:
 * - `kind`: 単一選択か複数選択か
 * - `choices`: 選択肢(この並び順で結果を組み立てる)
 * - `selectedIds`: 現在の選択状態
 * - `changedId`: 操作された選択肢の識別子
 * - `checked`: 操作後にその選択肢が選択中になるか
 *
 * Output:
 * - 単一: `[changedId]`。すでに選択中、または外す操作のときは `undefined`(通知なし)
 * - 複数: `choices` の並び順で、changedId を checked に合わせた識別子の一覧
 *
 * 例: `nextSelection("multiple", [a, b, c], ["c"], "a", true)` は `["a", "c"]`
 */
export const nextSelection = (
  kind: "single" | "multiple",
  choices: readonly ChoiceQuestionChoice[],
  selectedIds: readonly string[],
  changedId: string,
  checked: boolean,
): string[] | undefined => {
  if (kind === "single") {
    if (!checked || selectedIds.includes(changedId)) return undefined
    return [changedId]
  }
  const result: string[] = []
  for (const choice of choices) {
    const selected =
      choice.id === changedId ? checked : selectedIds.includes(choice.id)
    if (selected) result.push(choice.id)
  }
  return result
}

/**
 * 選択肢が上限のために選べない状態かを返す。
 *
 * Input:
 * - `kind`: 単一選択か複数選択か
 * - `choices`: 選択肢
 * - `selectedIds`: 現在の選択状態
 * - `choiceId`: 判定する選択肢の識別子
 * - `maxSelect`: 複数選択で選べる数の上限(未指定は制限なし)
 *
 * Output:
 * - 複数選択で上限が指定され、選択中の数(選択肢にある識別子のみ)が上限以上で、
 *   この選択肢が未選択のときだけ true。上限を超えていても補正しない。
 *
 * 例: `isChoiceLocked("multiple", [a, b, c], ["a", "b"], "c", 2)` は `true`
 */
export const isChoiceLocked = (
  kind: "single" | "multiple",
  choices: readonly ChoiceQuestionChoice[],
  selectedIds: readonly string[],
  choiceId: string,
  maxSelect: number | undefined,
): boolean => {
  if (kind !== "multiple" || maxSelect === undefined) return false
  if (selectedIds.includes(choiceId)) return false
  const count = choices.filter(choice => selectedIds.includes(choice.id)).length
  return count >= maxSelect
}

export type ChoiceQuestionProps = {
  /** 単一選択か複数選択か */
  kind: "single" | "multiple"
  /** 質問文(選択肢全体のラベルになる) */
  legend: ReactNode
  /** 選択肢(この順に縦へ並べる) */
  choices: readonly ChoiceQuestionChoice[]
  /** 選択中の選択肢の識別子。単一は 0 または 1 件 */
  selectedIds: readonly string[]
  /** 選択が変わったときに、次の選択の一覧を渡す(無効の間は呼ばれない) */
  onChange: (nextIds: string[]) => void
  /** 複数選択で選べる数の上限(1 以上の整数)。省略は制限なし。単一では無視する */
  maxSelect?: number
  /** true で全選択肢を操作できなくする */
  disabled?: boolean
  /** 質問のまとまりへの追加クラス(外側の配置用) */
  className?: string
}

/**
 * 選択式の質問を描画する。
 *
 * Input: `ChoiceQuestionProps`(種別・質問文・選択肢・選択状態・通知・上限・無効・クラス)
 * Output: 質問文を legend にした fieldset と、縦に並ぶ選択肢
 *
 * 例: `<ChoiceQuestion kind="single" legend="好きな色は" choices={[{ id: "r", label: "赤" }]} selectedIds={["r"]} onChange={setIds} />`
 */
export const ChoiceQuestion = ({
  kind,
  legend,
  choices,
  selectedIds,
  onChange,
  maxSelect,
  disabled = false,
  className,
}: ChoiceQuestionProps) => {
  const groupName = useId()

  /** 操作を 1.1 の規則で一覧にし、通知すべきときだけ onChange を呼ぶ。 */
  const notify = (changedId: string, checked: boolean) => {
    if (disabled) return
    if (isChoiceLocked(kind, choices, selectedIds, changedId, maxSelect)) return
    const next = nextSelection(kind, choices, selectedIds, changedId, checked)
    if (next !== undefined) onChange(next)
  }

  return (
    <fieldset
      className={`${styles["question"]}${className ? ` ${className}` : ""}`}
    >
      <legend className={styles["legend"]}>{legend}</legend>
      {choices.length > 0 && (
        <div className={styles["choices"]}>
          {choices.map(choice => {
            const checked = selectedIds.includes(choice.id)
            return kind === "single" ? (
              <RadioButton
                key={choice.id}
                name={groupName}
                checked={checked}
                label={choice.label}
                disabled={disabled}
                onSelect={() => notify(choice.id, true)}
              />
            ) : (
              <Checkbox
                key={choice.id}
                variant="card"
                checked={checked}
                label={choice.label}
                disabled={
                  disabled ||
                  isChoiceLocked(
                    kind,
                    choices,
                    selectedIds,
                    choice.id,
                    maxSelect,
                  )
                }
                onCheckedChange={next => notify(choice.id, next)}
              />
            )
          })}
        </div>
      )}
    </fieldset>
  )
}

export default ChoiceQuestion
