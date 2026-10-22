import { useEffect, useState } from "react"
import Overlay from "@/components/common/Overlay"
import calendarIcon from "@/images/calendar.svg"
import calendarWhiteIcon from "@/images/calendar-white.svg"
import { useT } from "@/lib/i18n/react"
import {
  checkRunAt,
  defaultRunAt,
  fromLocalInputValue,
  toLocalInputValue,
  type RunAtLimits,
} from "@/lib/schedule/runAtInput"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

/**
 * 投稿フォームのカレンダーのボタンと、実行日時の指定のダイアログ。
 *
 * 責務と処理概要:
 * - ボタンを押すと、日時の入力（端末のタイムゾーン）と「設定」「解除」「閉じる」のダイアログを開く。
 * - 入力の既定値は、設定済みの日時か、無ければ翌日の同時刻（秒以下は切り捨て）。
 * - サーバーが示す範囲の外の日時では「設定」を押せず、理由を表示する。
 * - 日時が設定されている間は、ボタンを強調の配色と `aria-pressed` で示す。
 * - 日時の保持と、設定・解除の結果の扱いは呼び出し側（投稿フォーム）が行う。
 *
 * 利用例:
 * `<RunAtPicker value={runAt} limits={limits} disabled={!enabled} onChange={next => ...} />`
 */

type Props = {
  value: Date | null
  /** null のとき（予約投稿が無効・制限値の取得前）はボタンを押せない */
  limits: RunAtLimits | null
  disabled: boolean
  /** ボタンを押せない理由（title に出す） */
  disabledReason?: string
  onChange: (next: Date | null) => void
  /** 開く操作を外から行うための状態（フォーム内の実行日時の行から開く） */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export const Component = ({
  value,
  limits,
  disabled,
  disabledReason,
  onChange,
  open: openProp,
  onOpenChange,
}: Props) => {
  const { t } = useT()
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = (next: boolean) => {
    setOpenState(next)
    onOpenChange?.(next)
  }
  const [input, setInput] = useState("")
  const unavailable = disabled || limits === null

  // 開くたびに（ボタンからでも実行日時の行からでも）、設定済みの日時か既定値を入力欄へ入れる
  useEffect(() => {
    if (open) setInput(toLocalInputValue(value ?? defaultRunAt(new Date())))
    // value は開いた時点の値だけを使う
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 範囲の判定。解釈できない入力は tooSoon として扱う
  const picked = fromLocalInputValue(input)
  const range =
    limits && picked ? checkRunAt(picked, new Date(), limits) : "tooSoon"
  const rangeMessage = !limits
    ? ""
    : range === "tooSoon"
      ? t("schedule.range.tooSoon", {
          minutes: Math.ceil(limits.minLeadSeconds / 60),
        })
      : range === "tooLate"
        ? t("schedule.range.tooLate", {
            days: Math.floor(limits.maxLeadSeconds / 86400),
          })
        : ""

  return (
    <>
      <button
        type="button"
        className={`${ui["base-button"]} ${value ? ui["blue-button"] : ui["white-button"]} ${ui["nontext-button"]} ${ui["md-button"]}`}
        aria-label={t("schedule.picker.button")}
        aria-pressed={value !== null}
        title={unavailable ? disabledReason : t("schedule.picker.button")}
        disabled={unavailable}
        data-testid="schedule-picker-button"
        onClick={() => setOpen(true)}
      >
        <img
          src={value ? calendarWhiteIcon.src : calendarIcon.src}
          width={18}
          height={18}
          className={styles.icon}
          alt=""
        />
      </button>
      <Overlay
        open={open}
        onClose={() => setOpen(false)}
        contentClassName={ui["width-sm"]}
      >
        <div
          className={`${ui["base-card"]} ${ui["dialog-card"]} ${ui["base-padding"]} ${styles.content}`}
          role="dialog"
          aria-label={t("schedule.picker.title")}
        >
          <h2 className={ui.subject}>{t("schedule.picker.title")}</h2>
          <div>
            <label htmlFor="schedule-run-at">
              {t("schedule.picker.runAt")}
            </label>
            <div className={ui["base-input-box"]}>
              <input
                className={ui["base-input-field"]}
                id="schedule-run-at"
                type="datetime-local"
                value={input}
                onChange={e => setInput(e.target.value)}
              />
            </div>
          </div>
          {rangeMessage && (
            <div className={styles.error} role="alert">
              {rangeMessage}
            </div>
          )}
          <div className={styles.actions}>
            {value && (
              <button
                type="button"
                className={`${ui["base-button"]} ${ui["text-button"]} ${ui["red-button"]}`}
                onClick={() => {
                  setOpen(false)
                  onChange(null)
                }}
              >
                {t("schedule.picker.clear")}
              </button>
            )}
            <button
              type="button"
              className={`${ui["base-button"]} ${ui["text-button"]} ${ui["white-button"]}`}
              onClick={() => setOpen(false)}
            >
              {t("schedule.picker.close")}
            </button>
            <button
              type="button"
              className={`${ui["base-button"]} ${ui["text-button"]} ${ui["blue-button"]}`}
              disabled={range !== "ok" || !picked}
              onClick={() => {
                if (!picked) return
                setOpen(false)
                onChange(picked)
              }}
            >
              {t("schedule.picker.set")}
            </button>
          </div>
        </div>
      </Overlay>
    </>
  )
}
export default Component
