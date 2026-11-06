/**
 * メンション/ハッシュタグ候補 1 件の型。
 *
 * 責務と処理概要:
 * - 候補を、メンション（Bluesky の候補）かハッシュタグのどちらかとして表す型だけを持つ。
 * - 値も React も持たない。候補の取得（`hooks/useSuggest.ts`）と候補の表示（`SuggestPopover`）が、
 *   互いを import せずに同じ型を参照できるよう、ここに置く。
 */
import type { MentionSuggestion } from "@/lib/atproto/suggest"
import type { HashtagCandidate } from "./suggestHashtags"

export type SuggestCandidate =
    | { kind: "mention"; item: MentionSuggestion }
    | { kind: "hashtag"; item: HashtagCandidate }
