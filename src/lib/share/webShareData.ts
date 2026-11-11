/**
 * WebShareAPI へ渡す共有データの純粋な組み立て。
 *
 * 責務と処理概要:
 * - 共有本文（本文 + 改行 + URL）と、画像 Blob から File への変換を行う。
 * - ブラウザの API（navigator）は使わない。実行は `components/share/IntentShareDialog/webShare` が担う。
 */

/**
 * Blob を WebShareAPI が要求する File へ変換する。
 *
 * Input:
 * - `blob`: 画像 Blob
 * - `index`: ファイル名採番用のインデックス
 *
 * Output:
 * - MIME タイプから拡張子を推定した `File`
 *
 * 例:
 * - 入力: `image/png` の Blob, `0`
 * - 出力: ファイル名 `image-0.png` の `File`
 */
export const toShareFile = (blob: Blob, index: number) => {
    const extension = blob.type.split("/")[1] ?? "png"
    return new File([blob], `image-${index}.${extension}`, {
        type: blob.type,
    })
}

/**
 * WebShareAPI へ渡す共有テキストを組み立てる。
 *
 * 処理の趣旨:
 * - `@/lib/share/intent`の`buildIntentText`と同じ「本文 + 改行 + URL」の形式にする。
 *
 * Input:
 * - `text`: 元の投稿本文
 * - `url`: 本文に付加するURL（skyshare entryのURL等）
 *
 * Output:
 * - WebShareAPI の `text` に渡す1つの文字列
 *
 * 例:
 * - 入力: `"こんにちは"`, `"https://example.com"`
 * - 出力: `"こんにちは\nhttps://example.com"`
 */
export const buildWebShareText = (text: string, url: string) => {
    const normalizedText = text.trim()
    if (normalizedText.length === 0) {
        return url
    }
    return `${normalizedText}\n${url}`
}
