/**
 * 構造の規約を読むテスト用の補助。規約は `.kiro/steering/structure*.md` に分けて置く。
 *
 * 責務と処理概要:
 * - `structure*.md` を名前順に連結した本文を返す（見出しや一文の存在を見る検査に使う）。
 * - 依存規則の表（`structure-checks.md`）だけを返す（表の行を読む検査に使う。連結すると他の表が混ざるため）。
 * - 小さい部品領域の判断の表は `structure-components.md` にあるため、その本文を返す。
 */
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

const repoRoot = path.resolve(__dirname, "../../..")
const steeringDir = path.join(repoRoot, ".kiro/steering")

/** `.kiro/steering/structure*.md` を名前順に連結した本文。 */
export const readSteeringStructure = (): string =>
    readdirSync(steeringDir)
        .filter(name => /^structure.*\.md$/.test(name))
        .sort()
        .map(name => readFileSync(path.join(steeringDir, name), "utf8"))
        .join("\n\n")

/** 依存規則の表を含む `structure-checks.md` の本文。 */
export const readStructureChecks = (): string =>
    readFileSync(path.join(steeringDir, "structure-checks.md"), "utf8")

/** 小さい部品領域の判断の表（`structure-components.md`）を含む本文。 */
export const readStructureDecisions = (): string =>
    readFileSync(path.join(steeringDir, "structure-components.md"), "utf8")
