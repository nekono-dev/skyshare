/**
 * Test helpers for reading structure guidance from structure guidance files.
 *
 *
 * - Joins `structure*.md` contents in name order for checks that look for headings and sentences.
 * - Reads only `structure-checks.md` for dependency table checks, avoiding unrelated tables.
 * - Reads `structure-components.md` for small component area decisions.
 */
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

const repoRoot = path.resolve(__dirname, "../../..")
const steeringDir = path.join(repoRoot, ".kiro/steering")

/** Concatenated structure guidance in name order. */
export const readSteeringStructure = (): string =>
    readdirSync(steeringDir)
        .filter(name => /^structure.*\.md$/.test(name))
        .sort()
        .map(name => readFileSync(path.join(steeringDir, name), "utf8"))
        .join("\n\n")

/** Contents of `structure-checks.md`, which contains the dependency table. */
export const readStructureChecks = (): string =>
    readFileSync(path.join(steeringDir, "structure-checks.md"), "utf8")

/** Contents of `structure-components.md`, which contains small component area decisions. */
export const readStructureDecisions = (): string =>
    readFileSync(path.join(steeringDir, "structure-components.md"), "utf8")
