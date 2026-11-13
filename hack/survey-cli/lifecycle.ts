/**
 * アンケートの状態表示・除去・配備先の純粋な判定を行う。
 * 既存の CLI 向けに、回答行と保持期限による判定も提供する。
 */
import type { Survey, SurveyConfig } from "@/lib/survey/definition"
import type { SurveyEnv } from "./args"
import { retentionExpired } from "@/lib/survey/period"

/**
 * 状態表示に使う 6 段階。
 *
 * Input: なし
 * Output: 6 段階のいずれか
 * 例: 終了済みで公開結果があれば `published`
 */
export type SurveyStage =
    "upcoming" | "active" | "closed" | "empty" | "hidden" | "published"

/**
 * 可視フラグの読み取り結果。
 *
 * Input: 結果保管先から読み取った可視状態
 * Output: 公開・非公開・形式不正のいずれか
 * 例: 不正な形式は `invalid` とし、段階を `hidden` にする
 */
export type VisibilityState = "visible" | "hidden" | "invalid"

/**
 * 目録にある集計状態。
 *
 * Input: 目録の記録と可視状態
 * Output: 結果・空・未集計のいずれか
 * 例: 記録が無い場合は `undefined`
 */
export type Aggregation =
    | { outcome: "result"; visibility: VisibilityState }
    | { outcome: "empty" }
    | undefined

/**
 * アンケートの開始・終了日時。
 *
 * Input: ISO 8601 の `opensAt` と `closesAt`
 * Output: 段階判定に使う期間
 * 例: `{ opensAt: "...Z", closesAt: "...Z" }`
 */
export type Period = { opensAt: string; closesAt: string }

/**
 * 状態表に表示する一行分の値。
 *
 * Input: 設定または目録の記録から作る
 * Output: ID・段階・終了日時・設定有無・可視状態の警告
 * 例: 不正な可視状態なら `invalidVisibility` が `true`
 */
export type StatusRow = {
    id: string
    stage: SurveyStage
    closesAt: string
    inConfig: boolean
    /** 可視フラグが不正な場合に警告を付ける。 */
    invalidVisibility: boolean
}

/**
 * 自動除去を保留したアンケートと未集計環境。
 *
 * Input: 対象 ID と集計の足りない環境
 * Output: 環境は `production`、`develop` の順
 * 例: develop のみ未集計なら `pending: ["develop"]`
 */
export type PruneKept = { id: string; pending: SurveyEnv[] }

/**
 * 運用者による除去の判定結果。
 *
 * Input: なし
 * Output: 除去、開催中の拒否、または未集計環境つきの拒否
 * 例: 開催中なら `{ kind: "refused", reason: "active" }`
 */
export type RemoveDecision =
    | { kind: "remove" }
    | { kind: "refused"; reason: "active" }
    | {
          kind: "refused"
          reason: "not-aggregated"
          pending: SurveyEnv[]
      }

type AggregatedByEnv = Readonly<Record<SurveyEnv, ReadonlySet<string>>>

const environments: readonly SurveyEnv[] = ["production", "develop"]

/**
 * 指定期間と集計状態から段階を返す。
 *
 * Input: 期間、目録の集計状態、判定時刻
 * Output: アンケートの 6 段階のいずれか
 * 例: `now` が `opensAt` より前なら `upcoming`
 */
export const surveyStage = (
    period: Period,
    aggregation: Aggregation,
    now: Date,
): SurveyStage => {
    const time = now.getTime()
    if (time < Date.parse(period.opensAt)) return "upcoming"
    if (time < Date.parse(period.closesAt)) return "active"
    if (!aggregation) return "closed"
    if (aggregation.outcome === "empty") return "empty"
    return aggregation.visibility === "visible" ? "published" : "hidden"
}

/**
 * 設定と目録の記録を開始時刻順の状態行にする。
 *
 * Input: 設定、ID ごとの目録情報、判定時刻
 * Output: 設定と目録だけの記録を含む状態行。題は含めない
 * 例: 設定に無い目録の記録も `inConfig: false` の行になる
 */
export const buildStatusRows = (
    config: SurveyConfig,
    index: ReadonlyMap<string, { period: Period; aggregation: Aggregation }>,
    now: Date,
): StatusRow[] => {
    const rows = new Map<string, StatusRow>()
    const opensAt = new Map<string, string>()
    for (const survey of config.surveys) {
        const aggregation = index.get(survey.id)?.aggregation
        const stage = surveyStage(survey, aggregation, now)
        opensAt.set(survey.id, survey.opensAt)
        rows.set(survey.id, {
            id: survey.id,
            stage,
            closesAt: survey.closesAt,
            inConfig: true,
            invalidVisibility:
                aggregation?.outcome === "result" &&
                aggregation.visibility === "invalid",
        })
    }
    for (const [id, entry] of index) {
        if (rows.has(id)) continue
        const stage = surveyStage(entry.period, entry.aggregation, now)
        opensAt.set(id, entry.period.opensAt)
        rows.set(id, {
            id,
            stage,
            closesAt: entry.period.closesAt,
            inConfig: false,
            invalidVisibility:
                entry.aggregation?.outcome === "result" &&
                entry.aggregation.visibility === "invalid",
        })
    }
    return [...rows.values()].sort((left, right) => {
        const startDifference =
            Date.parse(opensAt.get(left.id)!) -
            Date.parse(opensAt.get(right.id)!)
        return (
            startDifference ||
            (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
        )
    })
}

export type SurveyPhase = "upcoming" | "active" | "retained" | "expired"
export type RowPresence = "none" | "present" | "unknown"

export type PruneDecision = {
    remove: string[]
    kept: { id: string; reason: "rows" | "unknown" }[]
}

/** 指定時刻でのアンケートの段階を返す。 */
export const surveyPhase = (survey: Survey, now: Date): SurveyPhase => {
    const time = now.getTime()
    if (time < Date.parse(survey.opensAt)) return "upcoming"
    if (time < Date.parse(survey.closesAt)) return "active"
    return retentionExpired(survey, now).answers ? "expired" : "retained"
}

/** 回答の保持期限を過ぎたアンケートだけを返す。 */
export const pruneCandidates = (config: SurveyConfig, now: Date): Survey[] =>
    config.surveys.filter(survey => surveyPhase(survey, now) === "expired")

/**
 * 除去の判定を行う。旧形式は回答行、新形式は設定・両環境の集計状態を使う。
 *
 * Input: 旧形式では候補と回答行の有無、新形式では設定・集計済み ID・時刻
 * Output: 除去 ID と、旧形式では理由、新形式では未集計環境を含む保留 ID
 * 例: 新形式で両環境に ID がある終了済みアンケートは `remove` に入る
 */
export function decidePrune(
    candidates: readonly Survey[],
    presence: Readonly<Record<string, readonly RowPresence[]>>,
): PruneDecision
export function decidePrune(
    config: SurveyConfig,
    aggregated: AggregatedByEnv,
    now: Date,
): { remove: string[]; kept: PruneKept[] }
export function decidePrune(
    input: readonly Survey[] | SurveyConfig,
    presenceOrAggregated:
        Readonly<Record<string, readonly RowPresence[]>> | AggregatedByEnv,
    now?: Date,
): PruneDecision | { remove: string[]; kept: PruneKept[] } {
    if (!Array.isArray(input)) {
        const config = input as SurveyConfig
        const aggregated = presenceOrAggregated as AggregatedByEnv
        const remove: string[] = []
        const kept: PruneKept[] = []
        for (const survey of config.surveys) {
            if (now!.getTime() < Date.parse(survey.closesAt)) continue
            const pending = environments.filter(
                env => !aggregated[env].has(survey.id),
            )
            if (pending.length === 0) remove.push(survey.id)
            else kept.push({ id: survey.id, pending: [...pending] })
        }
        return { remove, kept }
    }
    const candidates = input as readonly Survey[]
    const presence = presenceOrAggregated as Readonly<
        Record<string, readonly RowPresence[]>
    >
    const remove: string[] = []
    const kept: PruneDecision["kept"] = []

    for (const survey of candidates) {
        const checks = presence[survey.id]
        if (checks?.length && checks.every(result => result === "none")) {
            remove.push(survey.id)
            continue
        }

        kept.push({
            id: survey.id,
            reason: checks?.includes("present") ? "rows" : "unknown",
        })
    }

    return { remove, kept }
}

/**
 * 運用者による除去が可能か、段階と両環境の集計状態から返す。
 *
 * Input: 対象アンケート、環境ごとの集計済み ID、判定時刻
 * Output: 除去または理由・不足環境つきの拒否
 * 例: 開始前は集計状況に関わらず `{ kind: "remove" }`
 */
export const decideRemove = (
    survey: Survey,
    aggregated: AggregatedByEnv,
    now: Date,
): RemoveDecision => {
    const time = now.getTime()
    if (time < Date.parse(survey.opensAt)) return { kind: "remove" }
    if (time < Date.parse(survey.closesAt)) {
        return { kind: "refused", reason: "active" }
    }
    const pending = environments.filter(env => !aggregated[env].has(survey.id))
    return pending.length === 0
        ? { kind: "remove" }
        : { kind: "refused", reason: "not-aggregated", pending: [...pending] }
}

/**
 * 最後に更新されたリリースブランチを返す。同時刻は名前の降順にする。
 *
 * Input: ブランチ名と先頭コミットの更新日時
 * Output: 選ばれたブランチ名。空なら `undefined`
 * 例: 同時刻なら名前が辞書順で後のブランチを返す
 */
export const latestReleaseBranch = (
    branches: readonly { name: string; committedAt: string }[],
): string | undefined =>
    [...branches].sort((left, right) => {
        const timeDifference =
            Date.parse(right.committedAt) - Date.parse(left.committedAt)
        if (timeDifference) return timeDifference
        return left.name === right.name ? 0 : left.name < right.name ? 1 : -1
    })[0]?.name

/**
 * ISO 8601 の日時を日本標準時の `YYYY-MM-DD HH:mm` にする。
 *
 * Input: ISO 8601 の日時
 * Output: 日本標準時の年月日と時分
 * 例: `2026-11-12T15:04:00Z` は `2026-11-13 00:04`
 */
export const formatJst = (iso: string): string => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(new Date(iso))
    const values = Object.fromEntries(
        parts.map(part => [part.type, part.value]),
    )
    return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}`
}
