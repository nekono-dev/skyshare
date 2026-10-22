/**
 * skyshare API 全エンドポイントの {path, method} → operation定義 対応表。
 *
 * 責務と処理概要:
 * - 各operationの実体(バリデーション用Zodスキーマ+OpenAPIメタデータ)は
 *   `src/lib/api/schema/**` の各エンドポイント別ファイルで定義され、ここでは
 *   URLパスへの割り当てのみを行う。
 * - `hack/build-openapi-document.ts` がこのファイルをimportしてOpenAPIドキュメントを組み立てる。
 */
import type { ZodOpenApiPathsObject } from "zod-openapi"

import { operation as extractUrlGet } from "./v1/extract/get"
import { operation as legacyPageGetByKey } from "./v1/page/_dbIndex/_dbKey/get"
import { operation as legacyPageDelete } from "./v1/page/delete"
import { operation as entryPost } from "./v2/entry/post"
import { operation as entryPut } from "./v2/entry/put"
import { operation as entryDelete } from "./v2/entry/delete"
import { operation as entriesGet } from "./v2/entries/get"
import { operation as skyshareEntriesGet } from "./v2/entries/skyshare/get"
import { operation as bskySessionGet } from "./v2/bsky/session/get"
import { operation as bskySessionPost } from "./v2/bsky/session/post"
import { operation as bskySessionPut } from "./v2/bsky/session/put"
import { operation as bskySessionDeleteByDid } from "./v2/bsky/session/_did/delete"
import { operation as bskyDraftsGet } from "./v2/bsky/drafts/get"
import { operation as bskyDraftsPost } from "./v2/bsky/drafts/post"
import { operation as bskyDraftsPut } from "./v2/bsky/drafts/put"
import { operation as bskyDraftsDelete } from "./v2/bsky/drafts/delete"
import { operation as schedulesGet } from "./v2/schedules/get"
import { operation as schedulesPost } from "./v2/schedules/post"
import { operation as schedulesDeleteById } from "./v2/schedules/_id/delete"
import { operation as schedulesGetById } from "./v2/schedules/_id/get"
import { operation as schedulesPutById } from "./v2/schedules/_id/put"
import { operation as scheduleImageGet } from "./v2/schedules/_id/images/_index/get"
import { operation as scheduleLimitsGet } from "./v2/schedules/limits/get"
import { operation as scheduleCredentialGet } from "./v2/schedules/credential/get"
import { operation as scheduleCredentialPut } from "./v2/schedules/credential/put"
import { operation as scheduleCredentialDelete } from "./v2/schedules/credential/delete"
import { operation as bskyImagesGet } from "./v2/bsky/images/get"
import { operation as bskyVideoUploadTokenPost } from "./v2/bsky/video/upload-token/post"

export const paths: ZodOpenApiPathsObject = {
    "/v1/extract/": { get: extractUrlGet },
    "/v1/page/": { delete: legacyPageDelete },
    "/v1/page/{dbIndex}/{dbKey}/": { get: legacyPageGetByKey },
    "/v2/entry/": { post: entryPost, put: entryPut, delete: entryDelete },
    "/v2/entries/": { get: entriesGet },
    "/v2/entries/skyshare/": { get: skyshareEntriesGet },
    "/v2/bsky/session/": {
        get: bskySessionGet,
        post: bskySessionPost,
        put: bskySessionPut,
    },
    "/v2/bsky/session/{did}/": { delete: bskySessionDeleteByDid },
    "/v2/bsky/drafts/": {
        get: bskyDraftsGet,
        post: bskyDraftsPost,
        put: bskyDraftsPut,
        delete: bskyDraftsDelete,
    },
    "/v2/schedules/": { get: schedulesGet, post: schedulesPost },
    "/v2/schedules/{id}/": {
        get: schedulesGetById,
        put: schedulesPutById,
        delete: schedulesDeleteById,
    },
    "/v2/schedules/{id}/images/{index}/": { get: scheduleImageGet },
    "/v2/schedules/limits/": { get: scheduleLimitsGet },
    "/v2/schedules/credential/": {
        get: scheduleCredentialGet,
        put: scheduleCredentialPut,
        delete: scheduleCredentialDelete,
    },
    "/v2/bsky/images/": { get: bskyImagesGet },
    "/v2/bsky/video/upload-token/": { post: bskyVideoUploadTokenPost },
}
