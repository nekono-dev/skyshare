/** 成功または HTTP エラーを返すサービス共通の型。 */

/**
 * 失敗の HTTP 状態コード。現行の応答で使う値に限る。
 */
export type FailureStatus = 400 | 401 | 404 | 409 | 429 | 500 | 503

/**
 * 判断の結果。
 *
 * - 成功: `{ ok: true; value }`
 * - 失敗: `{ ok: false; status; code? }`。`code` は競合の識別子（現行の応答の `error` に入る値）。
 */
export type Outcome<T> =
    | { ok: true; value: T }
    | {
          ok: false
          status: FailureStatus
          code?: "ScheduleCredentialRequired" | "ScheduleRunning"
      }
