/**
 * HLS プレイリストから動画の再生時間を算出する。
 */

const fetchOk = async (url: string): Promise<Response> => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`failed to fetch playlist: ${res.status}`)
    return res
}

/**
 * マスタープレイリストの最初のバリアントのメディアプレイリストを取得し、
 * `#EXTINF:<秒>,` の合計を返す。
 *
 * 失敗時の方針:
 * - いずれかの取得失敗・EXTINF が1件も無い・合計が 0 以下の場合は Error を throw する
 *   （呼び出し側が entry 作成を失敗させる。要件 FR-5）。
 *
 * 例:
 * - 入力: 4.0 + 4.0 + 2.5 秒のセグメントを持つプレイリストの URL
 * - 出力: `10.5`
 */
export const fetchVideoDurationSec = async (
    playlistUrl: string,
): Promise<number> => {
    const master = await (await fetchOk(playlistUrl)).text()
    const variant = master
        .split("\n")
        .map(line => line.trim())
        .find(line => line !== "" && !line.startsWith("#"))
    if (!variant) throw new Error("no variant playlist")
    const media = await (
        await fetchOk(new URL(variant, playlistUrl).href)
    ).text()
    const total = [...media.matchAll(/^#EXTINF:([0-9.]+)/gm)].reduce(
        (sum, match) => sum + Number(match[1]),
        0,
    )
    if (!(total > 0)) throw new Error("no segment duration")
    return total
}
