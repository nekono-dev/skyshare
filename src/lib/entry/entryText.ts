/**
 * skyshare entry の見出し(heading)・キャプション(caption)をクライアント側で組み立てる。
 *
 * 責務と処理概要:
 * - サーバは heading/caption を生成せず、`POST /v2/entry` で受け取った値をそのまま保存する。
 *   そのため作成時の既定値の決定はクライアントの責務であり、本モジュールに集約する。
 * - 上限は API スキーマ（`src/lib/api/schema/v2/entry/post.ts`）に合わせる。
 */

export const ENTRY_HEADING_MAX_LENGTH = 100
export const ENTRY_CAPTION_MAX_LENGTH = 300

export type EntryText = {
    heading?: string
    caption?: string
}

/**
 * entry 作成時の heading/caption を組み立てる。
 *
 * 処理の趣旨:
 * - 動画投稿は heading を付けない（キャプションのみ）。
 * - それ以外は heading を「<表示名> 's Post」、caption を投稿本文（trim後）とする。
 * - 本文が空白のみなら caption は付けない。上限超過分は切り詰める。
 *
 * Input:
 * - `userName`: 投稿者の表示名（無ければ handle）
 * - `postText`: source にする投稿の本文
 * - `isVideo`: 動画投稿かどうか
 *
 * Output:
 * - API へ送る `{ heading?, caption? }`（未設定のキーは含めない）
 *
 * 例:
 * - 入力: userName="Alice", postText=" Hello ", isVideo=false
 *   出力: { heading: "Alice 's Post", caption: "Hello" }
 * - 入力: userName="Alice", postText="Hello", isVideo=true
 *   出力: { caption: "Hello" }
 */
export const buildEntryText = (params: {
    userName: string
    postText: string
    isVideo: boolean
}): EntryText => {
    const { userName, postText, isVideo } = params
    const caption = postText.trim().slice(0, ENTRY_CAPTION_MAX_LENGTH)

    return {
        ...(isVideo
            ? {}
            : {
                  heading: `${userName} 's Post`.slice(
                      0,
                      ENTRY_HEADING_MAX_LENGTH,
                  ),
              }),
        ...(caption.length > 0 ? { caption } : {}),
    }
}
