/**
 * 起動時の判定の順序（除外 → アカウント → 設定と開催中 → このタブの辞退 → 起動時の判定）を行う。
 *
 * 責務と処理概要:
 * - 判定の順序は、ページの除外 → アクティブなアカウントの取得 → 設定の取得と開催中の判定 → このタブの辞退 → 起動時の判定。
 *   除外ページは何もせず `skipped` を返す（判定済みにしないため、呼び出し側が区別する）。
 *   途中で何もしないと決まった時点で後続の依存を呼ばない（未ログインなら設定も取得しない）。
 *   辞退の確認は、アンケートの識別子が設定から分かった後に行う（印がその識別子で保存されるため）。
 * - 依存（設定・辞退の印・アカウント・起動時の判定）は `GateDeps` で受け取り、判定そのものは例外を投げない。
 */
import type { Survey } from "@/lib/survey/definition"
import {
    isSurveyPageExcluded,
    type LaunchOutcome,
} from "@/lib/survey/launchCheck"

/** 判定の結果。`skipped` は判定を行わなかった（判定済みにしない） */
export type GateCheckResult =
    | { kind: "skipped" }
    | { kind: "none" }
    | { kind: "ask"; survey: Survey; did: string }

/** 判定の順序で呼ぶ依存。すべて例外を投げうる前提で呼び出し側が包む */
export type GateDeps = {
    /** 配信用の設定を取得し、開催中のアンケートを返す。無ければ undefined */
    loadSurvey: () => Promise<Survey | undefined>
    /** このタブで「回答しない」により辞退済みか */
    isDeclined: (surveyId: string) => boolean
    /** アクティブなアカウントの識別子。無ければ null */
    getDid: () => Promise<string | null>
    /** 起動時の判定（端末の記録とサーバーへの確認） */
    decide: (surveyId: string, did: string) => Promise<LaunchOutcome>
}

/**
 * 1 回の判定を、既定の順序で行う。例外は投げず、途中の失敗は `none` にする。
 *
 * Input:
 * - `pathname`・`search`: 現在のページの位置
 * - `deps`: 判定の依存
 *
 * Output:
 * - `skipped`: 除外ページ（依存は呼ばない）
 * - `ask`: 回答が必要と判定された（ダイアログを出す）
 * - `none`: 何もしない（設定なし・開催中なし・辞退・アカウントなし・判定の結果や例外）
 *
 * 例: `/privacy/` は `{ kind: "skipped" }`、未ログインは `loadSurvey` を呼ばず `{ kind: "none" }`。
 */
export const runGateCheck = async (input: {
    pathname: string
    search: string
    deps: GateDeps
}): Promise<GateCheckResult> => {
    const { pathname, search, deps } = input
    if (isSurveyPageExcluded(pathname, search)) return { kind: "skipped" }
    try {
        // 未ログインは追加の通信なしで判明するため、設定の取得より先に確かめる
        const did = await deps.getDid()
        if (!did) return { kind: "none" }
        const survey = await deps.loadSurvey()
        if (!survey) return { kind: "none" }
        // 辞退の印はアンケートの識別子で引くため、開催中のアンケートが分かった後に確かめる
        if (deps.isDeclined(survey.id)) return { kind: "none" }
        const outcome = await deps.decide(survey.id, did)
        return outcome === "ask"
            ? { kind: "ask", survey, did }
            : { kind: "none" }
    } catch {
        // 想定外の例外でも、利用者の操作を妨げずに何もしない
        return { kind: "none" }
    }
}
