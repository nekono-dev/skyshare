import { siteOrigin } from "@/vars"

/**
 * 単色背景 + イニシャル文字の簡易アバター/サムネイル画像を data URI で生成する。
 *
 * Input:
 * - `bg`: 背景色（CSSカラー）
 * - `label`: 中央に描く1〜2文字程度のラベル
 * - `size`: 一辺の px サイズ
 *
 * Output:
 * - `data:image/svg+xml,...` 形式の画像URL
 */
export const placeholderImage = (bg: string, label: string): string => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${1200}" height="${630}"><rect width="100%" height="100%" fill="${bg}"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="sans-serif" font-size="${Math.floor(630 / 3)}" fill="#fff">${label}</text></svg>`
    return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// sample.astroのOGP画像（og:image/twitter:image）用パス。
// data URI SVGはOGP取得ツールが画像として解釈できずリンクカードが表示されないため、
// `placeholderImage`と同内容をPNG化して`public/materials/`に配置したものを使う。
export const SAMPLE_OG_IMAGE_PATH = "/materials/sample-og.png"
export const SAMPLE_ORPHANED_OG_IMAGE_PATH = "/materials/sample-orphaned-og.png"

// 動画投稿のダミー。poster は静的画像、再生URLは実在しない（再生するとエラー表示になる）。
export const GUEST_VIDEO_POSTER_PATH = "/materials/sample-video-poster.png"
export const GUEST_VIDEO_PLAYLIST_URL =
    "https://video.bsky.app/watch/did%3Aplc%3Aguestdemo/bafkreiguestvideo/playlist.m3u8"

/**
 * ゲストモードの「Entryを開く」から実際に遷移できるサンプルEntry詳細ページ
 * （`src/pages/entries/sample.astro`）へのパス。
 * バックエンドの実レコードに依存しない静的ページのため、ダミーEntryのAT URIから
 * 通常経路で算出されるパス（存在しないレコードを指してしまう）の代わりにこちらを使う。
 * orphanedなダミーEntryも同じページへ遷移させる（サンプルページは1枚に集約している）。
 */
export const GUEST_SAMPLE_ENTRY_PATH = `${siteOrigin}/entries/sample/`
