/**
 * 1 件の公開済みアンケートについて、実施時期と質問別の結果を表示する。
 */
import { useId } from "react"
import { useLocale, useT } from "@/components/i18n/useTranslation"
import { localize } from "@/lib/survey/definition"
import {
  formatSurveyPeriod,
  topOptionIds,
} from "@/lib/survey/publicResults/presentation"
import type { SurveyResult } from "@/lib/survey/results/schema"
import ui from "@/styles/ui.module.css"
import PercentBar from "./PercentBar"
import styles from "./index.module.css"

type Props = { result: SurveyResult }

const SurveyResultCard = ({ result }: Props) => {
  // 見出しの id は、利用者が決める識別子と衝突しないよう、React が作る一意な値と質問の位置から作る
  const cardId = useId()
  const locale = useLocale()
  const { t } = useT()
  const period = formatSurveyPeriod(result.opensAt, result.closesAt)

  return (
    <article
      className={`${ui["base-card"]} ${ui["base-padding"]} ${styles.card}`}
    >
      <p className={`${ui["text-muted"]} ${styles.period}`}>
        {t("surveyResults.period", period)}
      </p>
      {result.questions.map((question, index) => {
        const highlighted = topOptionIds(question.options)
        const titleId = `${cardId}-question-${index}`

        return (
          <section
            key={question.id}
            className={styles.question}
            aria-labelledby={titleId}
          >
            <h2 id={titleId}>{localize(question.title, locale)}</h2>
            <div className={styles.options}>
              {question.options.map(option => (
                <PercentBar
                  key={option.id}
                  label={localize(option.label, locale)}
                  percent={option.percent}
                  highlight={highlighted.has(option.id)}
                />
              ))}
            </div>
          </section>
        )
      })}
    </article>
  )
}

export default SurveyResultCard
