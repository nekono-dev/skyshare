/**
 * 公開済みアンケート結果の見出しとカード一覧を表示する。
 */
import { useT } from "@/components/i18n/useTranslation"
import type { SurveyResult } from "@/lib/survey/results/schema"
import SurveyResultCard from "./SurveyResultCard"
import styles from "./index.module.css"

export type SurveyResultsProps = { surveys: SurveyResult[] }

const SurveyResults = ({ surveys }: SurveyResultsProps) => {
  const { t } = useT()

  return (
    <main className={styles.root}>
      <h1>{t("surveyResults.heading")}</h1>
      <div className={styles.list}>
        {surveys.map(result => (
          <SurveyResultCard key={result.id} result={result} />
        ))}
      </div>
    </main>
  )
}

export default SurveyResults
