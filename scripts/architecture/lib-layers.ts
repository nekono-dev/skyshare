/**
 * `src/lib/` の各領域を基盤層または業務層に分類する。
 *
 * - パス文字列だけで判定し、ファイルの存在は調べない。
 * - `src/lib/` 外や未登録の領域は `null` を返す。
 */

export type LibLayer = "基盤" | "業務"

/**
 * 領域 → 層の対応表。キーは `src/lib/` の直下の領域名（フォルダ名と `guestMode.ts` の名前）。
 * 新しい領域を加えたときは、この表と `structure-lib.md` の層の表を同じ変更で更新する。
 */
export const LIB_LAYER = {
    // 基盤: 他の領域が土台にする単位
    api: "基盤",
    atproto: "基盤",
    codegen: "基盤",
    i18n: "基盤",
    image: "基盤",
    oauth: "基盤",
    platform: "基盤",
    session: "基盤",
    site: "基盤",
    video: "基盤",
    // 業務: 機能の単位（`guestMode.ts` は `lib` 直下の業務のファイル）
    entry: "業務",
    feedback: "業務",
    guestMode: "業務",
    schedule: "業務",
    settings: "業務",
    share: "業務",
    survey: "業務",
    timeline: "業務",
} as const satisfies Record<string, LibLayer>

/** `src/lib/` の直下の領域名。対応表のキーから導く。 */
export type LibRegionName = keyof typeof LIB_LAYER

const LIB_PREFIX = "src/lib/"

/**
 * モジュールのパスから層を返す。
 * `src/lib/<領域>/...` は領域名で引き、`src/lib/guestMode.ts` は `guestMode` として引く。
 * `src/lib/` の外、または対応表に無い領域は `null`（検査側で未分類として扱う）。
 */
export const libLayerOf = (modulePath: string): LibLayer | null => {
    if (!modulePath.startsWith(LIB_PREFIX)) return null
    const rel = modulePath.slice(LIB_PREFIX.length)
    // 直下のファイル（guestMode.ts）は拡張子を除いた名前で引く
    const head = rel.split("/")[0]
    const region = head.endsWith(".ts") ? head.slice(0, -".ts".length) : head
    if (!Object.hasOwn(LIB_LAYER, region)) return null
    return LIB_LAYER[region as LibRegionName]
}
