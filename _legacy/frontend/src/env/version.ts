// Cloudflareだとファイル読み込みできない様子...アダプタの影響？
// npmへ環境変数を渡して作成してみる
export const version = `v${import.meta.env.PUBLIC_VERSION}`
export default version
