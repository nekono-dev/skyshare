/**
 * 認証不要の公開 AppView（`atpService`）に対する `AtpAgent` シングルトン。
 *
 * 責務と処理概要:
 * - ブラウザ側からメンション候補・ハッシュタグ候補・facets組み立て（`@handle`のdid解決を
 *   含む `com.atproto.identity.resolveHandle`）など、認証不要な公開操作のみに用いる。
 * - accessJwt/refreshJwt 等のセッション Cookie は一切扱わない。投稿自体
 *   （`app.bsky.feed.post` レコード作成）は引き続きサーバー側
 *   （`src/pages/v2/bsky/record.ts` の `context.locals.agent`）で行い、このモジュールとは無関係。
 * - `src/pages/v2/bsky/session.ts` の `fetchProfileMeta` が公開プロフィール取得に使う
 *   `new AtpAgent({ service: atpService })` と同じ生成方法をブラウザ側でも踏襲する。
 */
import { AtpAgent } from "@atproto/api"
import { atpService } from "@/env"

export const publicAtpAgent = new AtpAgent({ service: atpService })
