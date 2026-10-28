/**
 * ChoiceQuestion(選択式質問部品)の、選択の組み立てを行う純粋関数と型。
 *
 * 責務と処理概要:
 * - 選択の変化から、通知する次の選択の一覧を組み立てる(`nextSelection`)。
 * - 複数選択の上限により、選択肢が選べない状態かを判定する(`isChoiceLocked`)。
 * - どちらも React に依存せず、渡された選択状態を書き換えず、補正もしない。
 *   選択状態に選択肢にない識別子があっても例外を出さず、その識別子は結果に含めない。
 */
import type { ReactNode } from "react"

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
