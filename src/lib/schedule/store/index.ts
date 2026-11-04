/**
 * 予約の D1 ストアの入口（再エクスポート）。
 *
 * 責務と処理概要:
 * - 元の `schedule/store.ts` の export を、名前を変えずにすべて再エクスポートする。
 * - 呼び出し側は `@/lib/schedule/store` だけを参照する（`vi.mock` の解決先もこのファイル）。
 * - 内部の兄弟ファイル（rows・schedules・execution・credentials・oauthState）は直接参照しない。
 */
export {
    insertSchedule,
    getSchedule,
    listSchedules,
    deleteSchedule,
    updatePendingSchedule,
    deleteSchedulesExceptRunning,
    parseKeys,
    countPending,
} from "./schedules"

export {
    claimDueSchedules,
    saveProgress,
    releaseSchedule,
    failSchedule,
    completeSchedule,
    requeueStale,
    purgeFinished,
    STALE_SECONDS,
    FINISHED_RETENTION_SECONDS,
} from "./execution"

export {
    saveCredential,
    loadCredential,
    getCredentialStatus,
    touchCredential,
    deleteCredential,
    markCredentialReauth,
    purgeIdleCredentials,
    purgeReauthMarkers,
    CREDENTIAL_IDLE_SECONDS,
    REAUTH_MARKER_KEEP_SECONDS,
} from "./credentials"
export type { CredentialStatus } from "./credentials"

export {
    OAUTH_STATE_TTL_SECONDS,
    saveOAuthState,
    takeOAuthState,
    purgeOAuthStates,
} from "./oauthState"
