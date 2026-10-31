/**
 * API の推論結果が、atproto・feedback 側の型に代入可能であることを確かめる型検査（実行時には何もしない）。
 *
 * 責務と処理概要:
 * - API のスキーマ（`schema/`）は、コード生成ツールが相対 import で読み込むため、別の領域を参照しない。
 *   代入可能性の検査は、この API 領域の内側（ここ）に置く。
 * - atproto と feedback は api を import しないため、確かめる側はここに置く（依存の向きは lib/api → 他の領域の一方向）。
 */
import type {
    CommonFacetsType,
    CommonImagesMetaType,
    CommonOgMetaType,
    CommonReplyRefType,
    CommonStrongRefType,
    CommonVideoBlobType,
    CommonVideoMetaType,
} from "@/lib/api/schema/common"
import type { RequestBodyType } from "@/lib/api/schema/v2/feedback/post"
import type {
    BskyFacets,
    BskyImagesMeta,
    BskyOgMeta,
    BskyReplyRef,
    BskyStrongRef,
    BskyVideoBlob,
    BskyVideoMeta,
} from "@/lib/atproto/recordTypes"
import type { FeedbackSubmission } from "@/lib/feedback/submission"

type AssertAssignable<T extends U, U> = T

export type RecordTypeCompatibility = [
    AssertAssignable<CommonFacetsType, BskyFacets>,
    AssertAssignable<CommonImagesMetaType, BskyImagesMeta>,
    AssertAssignable<CommonOgMetaType, BskyOgMeta>,
    AssertAssignable<CommonReplyRefType, BskyReplyRef>,
    AssertAssignable<CommonStrongRefType, BskyStrongRef>,
    AssertAssignable<CommonVideoBlobType, BskyVideoBlob>,
    AssertAssignable<CommonVideoMetaType, BskyVideoMeta>,
]

export type FeedbackSubmissionCompatibility = AssertAssignable<
    RequestBodyType,
    FeedbackSubmission
>
