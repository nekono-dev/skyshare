import { describe, test, expect } from "@jest/globals"
import { getOgpMeta } from "../src/lib/getOgp"
import type { ogpMetaData, errorResponse } from "../src/lib/api/types"

const version = `v${process.env.PUBLIC_VERSION}`
const siteurl = "http://192.168.3.151:4321"

// 本テストは正しい情報取得のため、 `npm run prod` で APIサーバを起動して行うこと。
// 本番環境(cloudflare hosted)では、そもそもstatus codeが2XX系ではない場合、専用ページ(html)が返却されるため、
// テストはNGになるが、正しく 502コードが返却されるため、問題ない。

describe("getOgp Test", () => {
    test("True Website test", async () => {
        const result: ogpMetaData | errorResponse = await getOgpMeta({
            siteurl: siteurl,
            externalUrl: "https://skyshare.nekono.dev/",
            languageCode: "ja",
        })
        expect(result).toEqual(<ogpMetaData>{
            type: "meta",
            title: "Skyshare - Share Bluesky to X",
            description:
                "Skyshare is a web application helps bluesky users post to both bluesky or x.com.",
            image: `https://skyshare.nekono.dev/materials/ogp_main.png?updated=${version}`,
        })
    }, 10000) // long timeouf)
    // YoutubeはCORSが設定されている例
    test("True Website cors site test", async () => {
        const result: ogpMetaData | errorResponse = await getOgpMeta({
            siteurl: siteurl,
            externalUrl: "https://www.youtube.com/watch?v=xitQ_oNTVvE",
            languageCode: "ja",
        })
        expect(result).toEqual(<ogpMetaData>{
            type: "meta",
            title: "Google Chrome スピードテスト",
            description:
                "20秒でできる？Google Chromeブラウザでお出かけ前の情報チェック。google.co.jp/chrome",
            image: "https://i.ytimg.com/vi/xitQ_oNTVvE/hqdefault.jpg",
        })
    }, 100000) // long timeouf)
    // Zenn は twitter:imageが設定されていない例
    test("True Website no twitter:image test", async () => {
        const result: ogpMetaData | errorResponse = await getOgpMeta({
            siteurl: siteurl,
            externalUrl: "https://zenn.dev",
            languageCode: "ja",
        })
        expect(result).toEqual(<ogpMetaData>{
            type: "meta",
            title: "Zenn｜エンジニアのための情報共有コミュニティ",
            description:
                "Zennはエンジニアが技術・開発についての知見をシェアする場所です。本の販売や、読者からのバッジの受付により対価を受け取ることができます。",
            image: "https://static.zenn.studio/images/logo-only-dark.png",
        })
    }, 100000) // long timeouf)
    // It media はエンコーディングが古い shift-jisのサイト
    test("True Website shift-jis site test", async () => {
        const result: ogpMetaData | errorResponse = await getOgpMeta({
            siteurl: siteurl,
            externalUrl: "https://www.itmedia.co.jp/news/",
            languageCode: "ja",
        })
        expect(result).toEqual(<ogpMetaData>{
            type: "meta",
            title: "ITmedia NEWS",
            description:
                "ITがもたらす変化を敏感に感じ取り、仕事や生活に生かしていこうという企業内個人やネットサービス開発者、ベンチャー経営者をコアターゲットに、IT業界動向やネットサービストレンド、ネット上の話題までカバーするニュースを配信します。",
            image: "https://image.itmedia.co.jp/images/logo/1200x630_500x500_news.gif",
        })
    }, 100000) // long timeouf)

    // X.com は metaデータの順序がskyshareと異なる場合の例
    test("True Website shift-jis site test", async () => {
        const result: ogpMetaData | errorResponse = await getOgpMeta({
            siteurl: siteurl,
            externalUrl:
                "https://x.com/nekono_dev/status/1774369918726947311",
            languageCode: "ja",
        })
        expect(result).toEqual(<ogpMetaData>{
            type: "meta",
            title: "Xユーザーのねこの（公式）（@nekono_dev）さん",
            description: "検証用ツイート",
            image: "https://pbs.twimg.com/profile_images/1756477148867760128/jpPQdbbM_200x200.jpg",
        })
    }, 100000) // long timeouf)

    //twitter.com/nekono_dev/status/1774369918726947311
    test("Bad request localhost test", async () => {
        const result: ogpMetaData | errorResponse = await getOgpMeta({
            siteurl: siteurl,
            externalUrl: "http://localhost/",
            languageCode: "ja",
        })
        expect(result).toEqual(<errorResponse>{
            type: "error",
            error: "Bad Gateway@getOgpMeta",
            status: 500,
            message:
                "Failed to get correct response from gateway. Announce server administrator.",
        })
    }, 100000) // long timeouf)
    test("Bad request no dns ipv4 website test", async () => {
        const result: ogpMetaData | errorResponse = await getOgpMeta({
            siteurl: siteurl,
            externalUrl: "http://192.0.2.1/",
            languageCode: "ja",
        })
        expect(result).toEqual(<errorResponse>{
            type: "error",
            error: "Bad Gateway@getOgpMeta",
            status: 500,
            message:
                "Failed to get correct response from gateway. Announce server administrator.",
        })
    }, 100000) // long timeouf)
    test("Bad request no dns ipv6 website test", async () => {
        const result: ogpMetaData | errorResponse = await getOgpMeta({
            siteurl: siteurl,
            externalUrl: "http://[fe00::1]/",
            languageCode: "ja",
        })
        expect(result).toEqual(<errorResponse>{
            type: "error",
            error: "Bad Gateway@getOgpMeta",
            status: 500,
            message:
                "Failed to get correct response from gateway. Announce server administrator.",
        })
    }, 100000) // long timeouf)
    test("Bad request invalid protocol test", async () => {
        const result: ogpMetaData | errorResponse = await getOgpMeta({
            siteurl: siteurl,
            externalUrl: "file://./index.html",
            languageCode: "ja",
        })
        expect(result).toEqual(<errorResponse>{
            type: "error",
            error: "Bad Gateway@getOgpMeta",
            status: 500,
            message:
                "Failed to get correct response from gateway. Announce server administrator.",
        })
    }, 100000) // long timeouf)

    // Spotify
    test("True Website spotify test", async () => {
        const result: ogpMetaData | errorResponse = await getOgpMeta({
            siteurl: siteurl,
            externalUrl:
                "https://open.spotify.com/intl-ja/track/1ymTLB4lwhJMlHspIIOAN8",
            languageCode: "ja",
        })
        expect(result).toEqual(<ogpMetaData>{
            type: "meta",
            title: "Via Chicago",
            description: "ウィルコ · Kicking Television, Live in Chicago · 曲 · 2005",
            image: "https://i.scdn.co/image/ab67616d0000b273ca812e1712f8b09c30351378",
        })
    }, 100000) // long timeouf)
})
