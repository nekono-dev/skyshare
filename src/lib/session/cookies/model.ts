/**
 * Cookie に保持するセッションの型、検証、識別とプール項目への変換を定義する。
 *
 * - 保存時に `service` のないアプリパスワード Cookie は、環境依存を避けて既定のサービスとして読む。
 */

import type { AtpSessionData } from "@atproto/api"
import type { EcPrivateJwk } from "@/lib/oauth/jose"
import { atpService } from "@/env"

export const SESSION_COOKIE_NAME = "atp_session"

/** アプリパスワードのセッション（`@atproto/api` の `AtpAgent` のセッション） */
export type PasswordSession = {
    kind: "password"
    session: AtpSessionData
    service: string
}

/** OAuth のセッションのトークンと、それを使うための認可サーバーの情報 */
export type OAuthTokens = {
    accessToken: string
    /** アクセストークンの期限（UNIX 秒） */
    expiresAt: number
    refreshToken: string
    /** トークンが結び付いた DPoP の秘密鍵 */
    dpopJwk: EcPrivateJwk
    issuer: string
    tokenEndpoint: string
    revocationEndpoint?: string
    clientId: string
}

/** OAuth のセッション */
export type OAuthSession = {
    kind: "oauth"
    did: string
    handle: string
    /** アカウントの PDS の URL */
    pds: string
    oauth: OAuthTokens
}

/** cookie に保持するセッション */
export type StoredSession = PasswordSession | OAuthSession

/** プールに保持する非アクティブアカウント1件分の情報 */
export type PooledAccount = StoredSession & { addedAt: string }

/**
 * セッションのアカウントの識別子とハンドルを返す。
 *
 * 例: `sessionIdentity({ kind: "oauth", did: "did:plc:a", handle: "a.test", ... })` → `{ did: "did:plc:a", handle: "a.test" }`
 */
export const sessionIdentity = (
    s: StoredSession,
): { did: string; handle: string } =>
    s.kind === "oauth"
        ? { did: s.did, handle: s.handle }
        : { did: s.session.did, handle: s.session.handle }

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null

/**
 * 復号した JSON を `StoredSession` として読む（内部ユーティリティ）。
 *
 * 想定する入力形状(最小要件):
 * - OAuth: `{ kind: "oauth", did, handle, pds, oauth: { accessToken, expiresAt, refreshToken, dpopJwk, issuer, tokenEndpoint, clientId } }`
 * - アプリパスワード: `{ kind?: "password", session: { did, handle, ... }, service? }`（`kind` の省略を許す）
 *
 * Output: セッション。形が違えば undefined
 */
export const toStoredSession = (value: unknown): StoredSession | undefined => {
    if (!isRecord(value)) return undefined
    if (value.kind === "oauth") {
        const o = value.oauth
        if (
            typeof value.did !== "string" ||
            typeof value.handle !== "string" ||
            typeof value.pds !== "string" ||
            !isRecord(o) ||
            typeof o.accessToken !== "string" ||
            typeof o.expiresAt !== "number" ||
            typeof o.refreshToken !== "string" ||
            !isRecord(o.dpopJwk) ||
            typeof o.issuer !== "string" ||
            typeof o.tokenEndpoint !== "string" ||
            typeof o.clientId !== "string"
        ) {
            return undefined
        }
        return value as unknown as OAuthSession
    }
    if (value.kind !== undefined && value.kind !== "password") return undefined
    const session = value.session
    if (
        !isRecord(session) ||
        typeof session.did !== "string" ||
        typeof session.handle !== "string"
    ) {
        return undefined
    }
    return {
        kind: "password",
        session: session as unknown as AtpSessionData,
        // service が省略された Cookie は、本番と同じ既定値として読む（同期の関数のため実行時の環境は使わない）
        service: typeof value.service === "string" ? value.service : atpService,
    }
}

/**
 * セッションを `PooledAccount` へ変換する。
 *
 * Input: `s`: プールへ退避するセッション
 * Output: プール保存用の `PooledAccount`（退避した時刻を付ける）
 */
export function toPooledAccount(s: StoredSession): PooledAccount {
    return { ...s, addedAt: new Date().toISOString() }
}
