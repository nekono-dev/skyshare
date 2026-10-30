/**
 * SurveyGate（投稿フォームの下に置くアンケートの入口）。
 *
 * 責務と処理概要:
 * - マウント時に `enterPage` を呼ぶ。判定の順序は lib（`gate.ts`）に任せる。
 * - ダイアログの状態は `gateReducer` が持つ。送信と辞退の振る舞い、回答済みの記録と辞退の印の選択も lib（`createDialogHandlers`・`createLiveRuntime`）に任せる。
 * - この部品は、状態の読み出し・更新の受け渡し・判定の世代の参照だけを行う。端末の記録の関数はここから import しない。
 * - 未回答なら入口のボタンを出し、押されたときに `SurveyDialog` を開く。
 * - 何も表示しないときは何も描画しない（SSR でも同じ）。
 */
import React, { useEffect, useReducer, useRef } from "react"
import SurveyDialog from "@/components/survey/SurveyDialog"
import { surveyApi } from "@/lib/survey/client"
import { currentSurvey } from "@/lib/survey/period"
import { fetchSurveyConfig } from "@/lib/survey/loadConfig"
import { decideLaunch } from "@/lib/survey/launchCheck"
import { useT } from "@/lib/i18n/react"
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
import { getActiveAccountInfo } from "@/lib/account/activeAccountSession"

/** 判定の依存の実物。画面の外の I/O をここに集める */
const liveDeps: GateDeps = {
  loadSurvey: async () => {
    const config = await fetchSurveyConfig()
    return config ? currentSurvey(config, new Date()) : undefined
  },
  // 手動の入口は辞退後も使える。回答済みだけを非表示にする。
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
        // 閉じて開き直すときは下書きを初期化する。
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
