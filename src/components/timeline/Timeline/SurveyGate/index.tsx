/**
 * 投稿フォームの下にアンケート入口を表示し、回答状況に応じてダイアログを開く。
 * 判定・記録の I/O は survey ライブラリに委譲し、UI から端末記録へ直接依存しない。
 */
import React, { useEffect, useReducer, useRef } from "react"
import SurveyDialog from "@/components/timeline/Timeline/SurveyGate/SurveyDialog"
import { surveyApi } from "@/lib/survey/client"
import { currentSurvey } from "@/lib/survey/period"
import { fetchSurveyConfig } from "@/lib/survey/loadConfig"
import { decideLaunch } from "@/lib/survey/launchCheck"
import { useT } from "@/components/i18n/useTranslation"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"
import {
  createDialogHandlers,
  createLiveRuntime,
  enterPage,
  gateReducer,
  initialGateState,
  type GateAction,
  type GateDeps,
  type GateState,
} from "@/lib/survey/gate"
import { getActiveAccountInfo } from "@/lib/session/activeAccountSession"

/** 判定の依存の実物。画面の外の I/O をここに集める */
const liveDeps: GateDeps = {
  loadSurvey: async () => {
    const config = await fetchSurveyConfig()
    return config ? currentSurvey(config, new Date()) : undefined
  },
  // 手動入口は辞退後も使えるため、辞退状態では隠さない。
  isDeclined: () => false,
  getDid: async () => (await getActiveAccountInfo()).did,
  decide: (surveyId, did) => decideLaunch({ surveyId, did, api: surveyApi }),
}

/**
 * 投稿フォームの下の入口。未回答のときだけボタンを表示する。
 *
 * Input: なし（現在のページの位置と、判定の依存から決める）
 * Output: ボタンと必要に応じたダイアログ、または何も描画しない
 *
 * 例: `<SurveyGate />` を投稿フォームの直後に置く。
 */
const SurveyGate: React.FC = () => {
  const { t } = useT()
  const [state, dispatch] = useReducer(gateReducer, initialGateState)
  // 最新の状態。判定や送信を始める時点で読む（dispatch と同じ動作で同期的に進める）
  const stateRef = useRef<GateState>(initialGateState)
  // 判定の世代。新しい判定を始めたら増やし、古い結果を捨てる
  const generation = useRef(0)
  // 購読中かどうか。アンマウント後の判定の結果を捨てる
  const active = useRef(false)

  const send = (action: GateAction) => {
    stateRef.current = gateReducer(stateRef.current, action)
    dispatch(action)
  }

  const runtime = createLiveRuntime({
    dispatch: send,
    beginJudgement: () => {
      generation.current += 1
      return generation.current
    },
    isCurrent: value => active.current && value === generation.current,
  })
  const handlers = createDialogHandlers(
    () => stateRef.current,
    runtime,
    (surveyId, answers) => surveyApi.submitAnswers(surveyId, answers),
  )

  useEffect(() => {
    active.current = true
    const { pathname, search } = window.location
    void enterPage(
      { pathname, search, judgedKey: stateRef.current.judgedKey },
      runtime,
      liveDeps,
    )
    return () => {
      active.current = false
    }
  }, [])

  const { pending, open, busy, failed } = state
  if (!pending) return null
  return (
    <>
      <button
        type="button"
        className={`${ui["base-button"]} ${ui["blue-button"]} ${ui["text-button"]} ${styles["entry"]}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => send({ type: "open" })}
      >
        {t("survey.entry")}
      </button>
      {open ? (
        // 閉じて再度開くときは、新しいダイアログとして下書きを初期化する。
        <SurveyDialog
          key={pending.survey.id}
          survey={pending.survey}
          busy={busy}
          failed={failed}
          onSubmit={handlers.onSubmit}
          onDecline={handlers.onDecline}
        />
      ) : null}
    </>
  )
}

export default SurveyGate
