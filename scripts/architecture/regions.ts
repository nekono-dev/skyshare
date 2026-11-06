/**
 * 依存規則の検査の領域判定。
 *
 * 責務と処理概要:
 * - ファイルのパスから、そのファイルが属する領域を返す。
 * - 領域は次のとおり: `lib/<領域>`、`components/<領域>/<Name>`（部品フォルダ）、
 *   `components/<領域>`（部品フォルダの外）、それ以外は `src/` からの親ディレクトリ、`src/` 直下は `(root)`。
 *
 * 実装上の制約:
 * - 文字列だけで判定する（ファイルの存在を見ない）。
 */

const SRC_PREFIX = "src/"

/** リポジトリ直下からの相対パスの領域名。 */
export const regionOf = (modulePath: string): string => {
    const rel = modulePath.startsWith(SRC_PREFIX)
        ? modulePath.slice(SRC_PREFIX.length)
        : modulePath
    const parts = rel.split("/")
    if (parts.length === 1) return "(root)"
    if (parts[0] === "lib") {
        return parts.length === 2 ? "lib" : `lib/${parts[1]}`
    }
    if (parts[0] === "components") {
        return parts.length >= 4
            ? `components/${parts[1]}/${parts[2]}`
            : `components/${parts[1]}`
    }
    return parts.slice(0, -1).join("/")
}
