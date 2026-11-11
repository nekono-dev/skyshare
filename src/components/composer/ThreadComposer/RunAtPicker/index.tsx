/**
 * 投稿の実行日時を選ぶボタンとダイアログ。
 *
 * - 既定値は設定済み日時か翌日の同時刻（秒以下切り捨て）。端末のタイムゾーンで入力する。
 * - サーバーの許可範囲と予約枠に基づいて設定可否を示す。
 * - 予約機能が利用不可でも `onUnavailable` があれば、案内を開くためボタン操作を受け付ける。
 */
import { useEffect, useState } from "react"
import Overlay from "@/components/common/dialog/Overlay"
import calendarIcon from "@/images/calendar.svg"
import calendarWhiteIcon from "@/images/calendar-white.svg"
import { useLocale, useT } from "@/components/i18n/useTranslation"
import {
  checkRunAt,
  defaultRunAt,
  formatExpiryDate,
  fromLocalInputValue,
  toLocalInputValue,
  type RunAtLimits,
} from "@/lib/schedule/runAtInput"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

/** 待機中の予約の枠。`consumes` はこの予約が新たに枠を使うか（編集中の予約は使わない） */
export type ScheduleSlots = { used: number; max: number; consumes: boolean }

type Props = {
  value: Date | null
  /** null のとき（予約投稿が無効・制限値の取得前）はボタンを押せない */
  limits: RunAtLimits | null
  disabled: boolean
  /** ボタンを押せない理由（title に出す） */
  disabledReason?: string
  /** 予約投稿を使えない状態（無効・制限値の未取得）でボタンを押したとき。渡すと押せる無効表示にする */
  onUnavailable?: () => void
  /** 待機中の予約の枠。取得前・取得の失敗は null（枠の表示を出さない） */
  slots?: ScheduleSlots | null
  /** 許可の有効期限の目安。予約の登録で延長される有効期限の日付を表示する */
  expiresAt?: Date | null
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
  onUnavailable,
  slots = null,
  expiresAt = null,
  onChange,
  open: openProp,
  onOpenChange,
}: Props) => {
  const { t } = useT()
  const locale = useLocale()
  const [openState, setOpenState] = useState(false)
  const open = openProp ?? openState
  const setOpen = (next: boolean) => {
    setOpenState(next)
    onOpenChange?.(next)
  }
  const [input, setInput] = useState("")
  // 押せない状態。onUnavailable があれば、disabled 属性ではなく aria-disabled で見た目だけを無効にする
  const unavailable = disabled || limits === null
  const soft = unavailable && !disabled && onUnavailable !== undefined

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

  // 新たに枠を使う予約で空きが無ければ、日時を設定できない
  const remaining = slots ? Math.max(0, slots.max - slots.used) : null
  const full = slots !== null && slots.consumes && remaining === 0

  return (
    <>
      <button
        type="button"
        className={`${ui["base-button"]} ${value ? ui["blue-button"] : ui["white-button"]} ${ui["nontext-button"]} ${ui["md-button"]}`}
        aria-label={t("schedule.picker.button")}
        aria-pressed={value !== null}
        title={unavailable ? disabledReason : t("schedule.picker.button")}
        disabled={unavailable && !soft}
        aria-disabled={soft ? true : undefined}
        data-testid="schedule-picker-button"
        onClick={() => (soft ? onUnavailable?.() : setOpen(true))}
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
          {slots && remaining !== null && (
            <div className={styles.slots} data-testid="schedule-slots">
              <div className={styles["slots-label"]}>
                <span>{t("schedule.picker.slotsLabel")}</span>
                <span>
                  {t("schedule.picker.slotsRemaining", {
                    remaining,
                    max: slots.max,
                  })}
                </span>
              </div>
              <div
                className={styles["slots-bar"]}
                role="meter"
                aria-label={t("schedule.picker.slotsLabel")}
                aria-valuemin={0}
                aria-valuemax={slots.max}
                aria-valuenow={Math.min(slots.used, slots.max)}
                aria-valuetext={t("schedule.picker.slotsRemaining", {
                  remaining,
                  max: slots.max,
                })}
              >
                {Array.from({ length: slots.max }, (_, i) => (
                  <span
                    key={i}
                    className={styles["slot"]}
                    data-state={
                      i < slots.used
                        ? "used"
                        : slots.consumes && i === slots.used
                          ? "next"
                          : "free"
                    }
                  />
                ))}
              </div>
              {full && (
                <div className={styles.error} role="alert">
                  {t("schedule.picker.slotsFull")}
                </div>
              )}
            </div>
          )}
          {rangeMessage && (
            <div className={styles.error} role="alert">
              {rangeMessage}
            </div>
          )}
          {expiresAt && (
            <div className={styles.expiry} data-testid="schedule-expiry">
              {t("schedule.picker.expiresAt", {
                date: formatExpiryDate(expiresAt, locale),
              })}
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
              disabled={range !== "ok" || !picked || full}
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
