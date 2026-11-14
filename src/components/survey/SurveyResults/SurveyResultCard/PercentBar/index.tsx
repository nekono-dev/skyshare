/**
 * 選択肢の文言と割合を棒グラフで表示する。
 */
import { formatPercent } from "@/lib/survey/publicResults/presentation"
import { useT } from "@/components/i18n/useTranslation"
import styles from "./index.module.css"

type Props = {
  label: string
  percent: number
  highlight: boolean
}

const PercentBar = ({ label, percent, highlight }: Props) => {
  const { locale } = useT()
  const formattedPercent = `${formatPercent(percent, locale)}%`

  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <div
        className={styles.track}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={label}
      >
        {percent > 0 ? (
          <span
            className={styles.fill}
            data-top={highlight ? "true" : "false"}
            style={{ width: `${percent}%` }}
          >
            {formattedPercent}
          </span>
        ) : (
          <span className={styles.zeroPercent}>{formattedPercent}</span>
        )}
      </div>
    </div>
  )
}

export default PercentBar
