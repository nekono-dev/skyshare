/**
 * API の推論型が atproto・feedback 側の型に代入可能かを検査する（実行時には何もしない）。
 *
 * - API スキーマ（`schema/`）はコード生成ツールが相対 import で読み込むため、他領域を参照しない。代入可能性の検査は API 領域の内側に置く。
 * - atproto と feedback は api を import しないため、依存は lib/api から他領域への一方向になる。
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
import type { FeedbackSubmission } from "@/lib/api/contract/feedbackSubmission"

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
