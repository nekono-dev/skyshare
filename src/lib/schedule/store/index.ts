/**
 * 予約の D1 ストア操作を公開する入口。
 *
 * - 呼び出し側はこの入口を参照し、内部ファイルを直接参照しない（`vi.mock` の解決先を保つ）。
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
