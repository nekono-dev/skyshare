/**
 * ChoiceQuestionSample(選択式質問部品の確認用部品)。
 *
 * 責務と処理概要:
 * - 単一選択・複数選択・上限つきの複数選択(最大 2 件)・操作できない状態の 4 例を表示する。
 * - 各例が自分の選択状態(識別子の配列)を `useState` で持ち、`ChoiceQuestion` へ渡す。
 * - 各例の下に、現在の選択状態を識別子の一覧として表示する(`data-testid="selected-<例>"`)。
 *   Playwright が操作後の表示を確認する対象であり、新しい契約は持たない。
 * - 固定の例文のみを使う(i18n 辞書は使わない)。
 */
import { useState } from "react"
import ChoiceQuestion, {
  type ChoiceQuestionChoice,
} from "@/components/common/ChoiceQuestion"

/** 全例で共通の選択肢(識別子 a から d)。長い表示文は折り返しの確認用。 */
const choices: ChoiceQuestionChoice[] = [
  { id: "a", label: "りんご" },
  { id: "b", label: "みかん" },
  { id: "c", label: "ぶどう" },
  {
    id: "d",
    label:
      "とても長い表示文の選択肢です。幅の狭い画面でも折り返して横にあふれないことを確認します。",
  },
]

/**
 * 選択状態を識別子の一覧として表示する。
 *
 * Input: `name`(例の名前、testid に使う)、`ids`(選択状態)
 * Output: 識別子をカンマ区切りにした文字列(未選択は「なし」)を持つ要素
 *
 * 例: `<SelectedIds name="single" ids={["a", "c"]} />` は「選択中: a,c」
 */
const SelectedIds = ({
  name,
  ids,
}: {
  name: string
  ids: readonly string[]
}) => (
  <p>
    選択中: <span data-testid={`selected-${name}`}>{ids.join(",")}</span>
  </p>
)

/**
 * 4 例を縦に並べて表示する。
 *
 * Input: なし
 * Output: 各例の質問と、その下の選択状態の一覧
 *
 * 例: `<ChoiceQuestionSample />`
 */
export const ChoiceQuestionSample = () => {
  const [single, setSingle] = useState<string[]>([])
  const [multiple, setMultiple] = useState<string[]>([])
  const [limited, setLimited] = useState<string[]>([])
  const [disabled, setDisabled] = useState<string[]>(["b", "c"])

  return (
    <>
      <section>
        <ChoiceQuestion
          kind="single"
          legend="単一選択: 好きな果物は"
          choices={choices}
          selectedIds={single}
          onChange={ids => setSingle(ids)}
        />
        <SelectedIds name="single" ids={single} />
      </section>
      <section>
        <ChoiceQuestion
          kind="multiple"
          legend="複数選択: 好きな果物は(いくつでも)"
          choices={choices}
          selectedIds={multiple}
          onChange={ids => setMultiple(ids)}
        />
        <SelectedIds name="multiple" ids={multiple} />
      </section>
      <section>
        <ChoiceQuestion
          kind="multiple"
          legend="上限つきの複数選択: 好きな果物は(最大 2 件)"
          choices={choices}
          selectedIds={limited}
          maxSelect={2}
          onChange={ids => setLimited(ids)}
        />
        <SelectedIds name="limited" ids={limited} />
      </section>
      <section>
        <ChoiceQuestion
          kind="multiple"
          legend="操作できない状態: 好きな果物は"
          choices={choices}
          selectedIds={disabled}
          disabled
          onChange={ids => setDisabled(ids)}
        />
        <SelectedIds name="disabled" ids={disabled} />
      </section>
    </>
  )
}

export default ChoiceQuestionSample
