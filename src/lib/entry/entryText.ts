/**
 * skyshare entry の見出し(heading)・キャプション(caption)をクライアント側で組み立てる。
 *
 * 責務と処理概要:
 * - サーバは heading/caption を生成せず、`POST /v2/entry` で受け取った値をそのまま保存する。
 *   そのため作成時の既定値の決定はクライアントの責務であり、本モジュールに集約する。
 * - 上限は API スキーマ（`src/lib/api/schema/v2/entry/post.ts`）に合わせる。
 */

import { formatVideoDuration } from "@/lib/video/formatVideoDuration"
import { serviceName } from "@/vars"

export const ENTRY_HEADING_MAX_LENGTH = 100
export const ENTRY_CAPTION_MAX_LENGTH = 300

// 上限超過時も接尾辞は残すため、投稿者名側を切り詰める。
const HEADING_SUFFIX = ` | ${serviceName}`

export type EntryText = {
    heading?: string
    caption?: string
}

/**
 * entry 作成時の heading/caption を組み立てる。
 *
 * 処理の趣旨:
 * - heading は X の twitter:title が空だと OGP カードが正しく生成されないため、空にしない。
 *   画像投稿は「<投稿者名> | <サービス名>」、動画投稿は動画の再生時間（`m:ss`）とする。
 *   投稿者名のみ（短い・日本語のみ等）だと X 上で twitter:title が採用されず、ドメイン表示に
 *   なることがあったため、サービス名を付けた形式にしている。動画の再生時間は
 *   visual へ埋め込まず heading で示し、X 上のリンクカードを動画に見せる。
 * - caption は投稿本文（trim後）とする。本文が空白のみなら caption は付けない。上限超過分は切り詰める。
 *
 * Input:
 * - `userName`: 投稿者の表示名（無ければ handle）
 * - `postText`: source にする投稿の本文
 * - `videoDurationSec`: 動画投稿の場合のみ、動画の再生時間（秒）
 *
 * Output:
 * - API へ送る `{ heading, caption? }`（caption 未設定時はキーを含めない）
 *
 * 例:
 * - 入力: userName="Alice", postText=" Hello "
 *   出力: { heading: "Alice | Skyshare", caption: "Hello" }
 * - 入力: userName="Alice", postText="Hello", videoDurationSec=65
 *   出力: { heading: "1:05", caption: "Hello" }
 */
export const buildEntryText = (params: {
    userName: string
    postText: string
    videoDurationSec?: number
}): EntryText => {
    const { userName, postText, videoDurationSec } = params
    const caption = postText.trim().slice(0, ENTRY_CAPTION_MAX_LENGTH)

    return {
        heading:
            videoDurationSec !== undefined
                ? formatVideoDuration(videoDurationSec)
                : `${userName.slice(0, ENTRY_HEADING_MAX_LENGTH - HEADING_SUFFIX.length)}${HEADING_SUFFIX}`,
        ...(caption.length > 0 ? { caption } : {}),
    }
}
