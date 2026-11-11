/**
 * `src/` からの相対パスを、依存規則で使う領域名に変換する。
 *
 * - パス文字列だけで判定し、ファイルの存在は調べない。
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
