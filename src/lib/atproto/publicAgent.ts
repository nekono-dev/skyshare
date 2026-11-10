/**
 * 認証不要の公開 AppView に接続する `AtpAgent` のシングルトン。
 *
 * - 接続先は `@/env` の `atpService`（`publicEndpoints.appView`）。
 * - セッションの資格情報（accessJwt・refreshJwt など）は扱わない。
 */
import { AtpAgent } from "@atproto/api"
import { atpService } from "@/env"

export const publicAtpAgent = new AtpAgent({ service: atpService })
