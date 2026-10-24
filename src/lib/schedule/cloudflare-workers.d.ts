// `wrangler types` の生成物を置かないため、予約投稿が使う範囲の型だけを宣言する
declare module "cloudflare:workers" {
    export const env: Record<string, unknown>
}
