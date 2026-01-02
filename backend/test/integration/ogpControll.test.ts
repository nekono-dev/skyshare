import { describe, it, expect } from 'vitest';
import getMeta from '@/api/v1.6/ogp/meta.get.service.js';

describe('getOgp Test', () => {
    // YoutubeはCORSが設定されている例
    it('True Website cors site test', async () => {
        const result = await getMeta({
            url: 'https://www.youtube.com/watch?v=xitQ_oNTVvE',
            lang: 'ja',
        });
        expect(result).toEqual({
            success: true,
            data: {
                title: 'Google Chrome スピードテスト',
                description:
                    '20秒でできる？Google Chromeブラウザでお出かけ前の情報チェック。google.co.jp/chrome',
                image: 'https://i.ytimg.com/vi/xitQ_oNTVvE/hqdefault.jpg',
            },
        });
    }, 50000);
    // Zenn は twitter:imageが設定されていない例
    it('True Website no twitter:image test', async () => {
        const result = await getMeta({
            url: 'https://zenn.dev',
            lang: 'ja',
        });
        expect(result).toEqual({
            success: true,
            data: {
                title: 'Zenn｜エンジニアのための情報共有コミュニティ',
                description:
                    'Zennはエンジニアが技術・開発についての知見をシェアする場所です。本の販売や、読者からのバッジの受付により対価を受け取ることができます。',
                image: 'https://static.zenn.studio/images/logo-only-dark.png',
            },
        });
    }, 50000);
    // It media はエンコーディングが古い shift-jisのサイト
    it('True Website shift-jis site test', async () => {
        const result = await getMeta({
            url: 'https://www.itmedia.co.jp/news/',
            lang: 'ja',
        });
        expect(result).toEqual({
            success: true,
            data: {
                title: 'ITmedia NEWS',
                description:
                    'ITがもたらす変化を敏感に感じ取り、仕事や生活に生かしていこうという企業内個人やネットサービス開発者、ベンチャー経営者をコアターゲットに、IT業界動向やネットサービストレンド、ネット上の話題までカバーするニュースを配信します。',
                image: 'https://image.itmedia.co.jp/images/logo/1200x630_500x500_news.gif',
            },
        });
    }, 50000);

    // X.com は metaデータの順序がskyshareと異なる場合の例
    it('True Website shift-jis site test', async () => {
        const result = await getMeta({
            url: 'https://x.com/nekono_dev/status/1774369918726947311',
            lang: 'ja',
        });
        expect(result).toEqual({
            success: true,
            data: {
                title: 'Xユーザーのねこの（公式）（@nekono_dev）さん',
                description: '検証用ツイート',
                image: 'https://pbs.twimg.com/profile_images/1756477148867760128/jpPQdbbM_200x200.jpg',
            },
        });
    }, 50000);

    //twitter.com/nekono_dev/status/1774369918726947311
    it('Bad request localhost test', async () => {
        const result = await getMeta({
            url: 'http://localhost/',
            lang: 'ja',
        });
        expect(result).toEqual({
            success: false,
            error: 'InternalServerError',
        });
    }, 50000);
    it('Bad request no dns ipv4 website test', async () => {
        const result = await getMeta({
            url: 'http://192.0.2.1/',
            lang: 'ja',
        });
        expect(result).toEqual({
            success: false,
            error: 'InternalServerError',
        });
    }, 50000);
    it('Bad request no dns ipv6 website test', async () => {
        const result = await getMeta({
            url: 'http://[fe00::1]/',
            lang: 'ja',
        });
        expect(result).toEqual({
            success: false,
            error: 'InternalServerError',
        });
    }, 50000);
    it('Bad request invalid protocol test', async () => {
        const result = await getMeta({
            url: 'file://./index.html',
            lang: 'ja',
        });
        expect(result).toEqual({
            success: false,
            error: 'InternalServerError',
        });
    }, 50000);

    // Spotify
    it('True Website spotify test', async () => {
        const result = await getMeta({
            url: 'https://open.spotify.com/intl-ja/track/1ymTLB4lwhJMlHspIIOAN8',
            lang: 'ja',
        });
        expect(result).toEqual({
            success: true,
            data: {
                title: 'Via Chicago',
                description:
                    'ウィルコ · Kicking Television, Live in Chicago · 曲 · 2005',
                image: 'https://i.scdn.co/image/ab67616d0000b273ca812e1712f8b09c30351378',
            },
        });
    }, 50000);
});
