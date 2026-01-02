import { launchEnv } from '../common/environments.js';
import * as cheerio from 'cheerio';

const protocol_validation: RegExp =
    /(dict|file|ftp|gopher|ldap|smtp|telnet|tftp):\/\//;
const loopback_validation: RegExp = /localhost/;
const ipv4_validation: RegExp = /(?:\d{0,3}\.){3}\d{0,3}/;
const ipv6_validation: RegExp = /\[[0-9a-fA-F:]+\]/;

/**
 * apiResponseを返します。リクエストに問題がある場合はエラーレスポンスを返します。
 * @param request リクエスト
 * @returns apiResponse または エラーレスポンス
 */
const isRequestURLInvalid = ({ url }: { url: string }): boolean => {
    const decodedUrl: string = decodeURIComponent(url);

    const isInvalidUrl: boolean =
        launchEnv !== 'local'
            ? protocol_validation.test(decodedUrl) ||
              loopback_validation.test(decodedUrl) ||
              ipv4_validation.test(decodedUrl) ||
              ipv6_validation.test(decodedUrl)
            : false;

    return isInvalidUrl;
};

const twitterHostnames = ['twitter.com', 'x.com'];
const getUserAgent = (url: string): string => {
    const userAgent: string = 'nodejs-server';

    if (userAgent === null || isTwitterUrl(new URL(url))) {
        return 'bot';
    }
    return userAgent;
};

const isTwitterUrl = (url: URL): boolean => {
    return twitterHostnames.includes(url.hostname);
};

const findEncoding = async (htmlBlob: Blob): Promise<string> => {
    const text = await htmlBlob.text();
    const headerRegExp: Array<RegExp> = [
        /(?: *< *meta +charset=["']?)([^"']*)["']?/i,
        /(?: *< *meta +http-equiv=["']?content-type["']? +content=["']?[^"']*charset=)([^"']*)["']?/i,
    ];

    let charset: string | undefined;

    for (const filter of headerRegExp) {
        if (charset === undefined) {
            const regResult: RegExpExecArray | null = filter.exec(text);
            if (regResult !== null) {
                charset = regResult[1];
            }
        }
    }
    charset = typeof charset !== 'undefined' ? charset.toLowerCase() : 'utf-8'; // default

    return charset;
};

const unescapeHtml = (html: string): string => {
    return html.replace('&amp;', '&').replace('&#38;', '&');
};

const extractHead = ({ html }: { html: string }) => {
    const $ = cheerio.load(html);

    let title: string | undefined = undefined;
    let description: string | undefined = undefined;
    let image: string | undefined = undefined;

    $('meta').each((_, element) => {
        const property: string | undefined = $(element).attr('property');
        const name: string | undefined = $(element).attr('name');
        const content: string | undefined = $(element).attr('content');
        const value: string | undefined = $(element).attr('value');

        if (typeof content === 'undefined') {
            return;
        }

        // twitter用メタを優先する
        if (
            typeof title === 'undefined' &&
            typeof name !== 'undefined' &&
            name.toLowerCase() === 'twitter:title'
        ) {
            title = content || value;
        }
        if (
            typeof description === 'undefined' &&
            typeof name !== 'undefined' &&
            name.toLowerCase() === 'twitter:description'
        ) {
            description = content || value;
        }
        if (
            typeof image === 'undefined' &&
            typeof name !== 'undefined' &&
            name.toLowerCase() === 'twitter:image'
        ) {
            image = content || value;
        }

        // OGメタを調べる
        if (
            typeof property !== 'undefined' &&
            property.toLowerCase() === 'og:title'
        ) {
            title = content || value;
        }
        if (
            typeof property !== 'undefined' &&
            property.toLowerCase() === 'og:description'
        ) {
            description = content || value;
        }
        if (
            typeof property !== 'undefined' &&
            property.toLowerCase() === 'og:image'
        ) {
            image = content || value;
        }
    });

    return {
        title: typeof title !== 'undefined' ? title : '',
        description: typeof description !== 'undefined' ? description : '',
        image: typeof image !== 'undefined' ? image : '',
    };
};

export {
    isRequestURLInvalid,
    getUserAgent,
    findEncoding,
    unescapeHtml,
    extractHead,
};
