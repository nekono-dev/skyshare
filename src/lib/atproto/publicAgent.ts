/**
 * 認証不要の公開 AppView に対する `AtpAgent` シングルトン。
 *
 * 責務と処理概要:
 * - ブラウザ側のメンション候補・ハッシュタグ候補・リスト・facets 組み立て（`@handle` の DID 解決を含む）と、
 *   サーバー側の Entry 削除範囲の判定に使う。接続先は wrangler.jsonc の vars（`atpService`）から入る。
 * - accessJwt/refreshJwt 等のセッション Cookie は一切扱わない。
 */
import { AtpAgent } from "@atproto/api"
import { atpService } from "@/env"

export const publicAtpAgent = new AtpAgent({ service: atpService })
