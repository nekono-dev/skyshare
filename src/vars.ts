export const serviceName = "Skyshare"
export const serviceDescription = `${serviceName} is a web application helps bluesky users post to both bluesky or x.com.`
/** ビルド時に埋め込まれた版。環境の値は、この `vars.ts` の 1 箇所だけで読む（要件 5.1）。 */
export const buildVersion = import.meta.env.PUBLIC_VERSION
/** 本番のドメイン（Astro の組み込みの値）。URL の組み立てに使う。 */
export const siteOrigin = import.meta.env.SITE
export const serviceVersion = `${buildVersion}`
export const extractorApi = `${import.meta.env.PUBLIC_OGP_EXTRACTOR_API}`
