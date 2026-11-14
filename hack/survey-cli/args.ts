/**
 * survey CLI の引数を検証し、型のあるコマンドへ変換する。
 */
import { idSchema } from "@/lib/api/contract/surveyPath"

export type SurveyEnv = "production" | "develop"

export type Command =
    | { name: "add"; file: string; dryRun: boolean }
    | { name: "status"; env: SurveyEnv }
    | {
          name: "publish" | "unpublish"
          id: string
          env: SurveyEnv
          deploy: boolean
          dryRun: boolean
      }
    | { name: "prune"; dryRun: boolean }
    | { name: "remove"; id: string; dryRun: boolean }

export type ParsedArgs =
    { ok: true; command: Command; repo?: string } | { ok: false; usage: string }

const failure = (message: string): ParsedArgs => ({
    ok: false,
    usage: `error: usage: ${message}`,
})

const validRepo = (value: string): boolean =>
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)

/**
 * 引数を検証してコマンドに変換する。
 *
 * Input: `argv` はコマンド名と未検証の引数配列
 * Output: 型付きコマンド、または入力値を含まない使い方エラー
 * 例: `status --env develop` は develop 環境の status コマンドになる
 */
export const parseArgs = (argv: readonly string[]): ParsedArgs => {
    const args: string[] = []
    let repo: string | undefined
    for (let index = 0; index < argv.length; index += 1) {
        const value = argv[index]!
        if (value === "--repo") {
            if (repo !== undefined)
                return failure("--repo は 1 回だけ指定できます")
            const next = argv[index + 1]
            if (!next || next.startsWith("--"))
                return failure("--repo に owner/repo を指定してください")
            if (!validRepo(next))
                return failure("--repo は owner/repo の形式で指定してください")
            repo = next
            index += 1
        } else {
            args.push(value)
        }
    }

    const candidate = args[0]
    if (
        !candidate ||
        !["add", "status", "publish", "unpublish", "prune", "remove"].includes(
            candidate,
        )
    ) {
        return failure("コマンドを指定してください")
    }
    const name = candidate as Command["name"]
    const tokens = args.slice(1)
    const positionals: string[] = []
    const options = new Map<string, string | true>()
    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index]!
        if (!token.startsWith("--")) {
            positionals.push(token)
            continue
        }
        if (token === "--force") return failure("未知の指定です")
        if (!["--file", "--env", "--dry-run", "--no-deploy"].includes(token)) {
            return failure("未知の指定です")
        }
        if (options.has(token)) return failure("同じ指定は重ねて使えません")
        if (token === "--file" || token === "--env") {
            const next = tokens[index + 1]
            if (!next || next.startsWith("--"))
                return failure("指定の値がありません")
            options.set(token, next)
            index += 1
        } else {
            options.set(token, true)
        }
    }
    const file = options.get("--file")
    const env = options.get("--env")
    const dryRun = options.has("--dry-run")
    const noDeploy = options.has("--no-deploy")
    if (
        positionals.length >
        (name === "publish" || name === "unpublish" || name === "remove"
            ? 1
            : 0)
    ) {
        return failure("余分な引数があります")
    }
    if (name === "add") {
        if (env !== undefined) return failure("add では --env を使えません")
        if (noDeploy)
            return failure("このコマンドでは --no-deploy を使えません")
        if (positionals.length) return failure("余分な引数があります")
        if (typeof file !== "string")
            return failure("add --file <パス> を指定してください")
        return {
            ok: true,
            command: { name, file, dryRun },
            ...(repo ? { repo } : {}),
        }
    }
    if (file !== undefined)
        return failure("このコマンドでは --file を使えません")
    if (name === "prune" || name === "remove") {
        if (env !== undefined) return failure(`${name} では --env を使えません`)
        if (noDeploy)
            return failure("このコマンドでは --no-deploy を使えません")
        if (name === "prune") {
            if (positionals.length) return failure("余分な引数があります")
            return {
                ok: true,
                command: { name, dryRun },
                ...(repo ? { repo } : {}),
            }
        }
        const id = positionals[0]
        if (!id) return failure("remove に識別子を指定してください")
        if (!idSchema.safeParse(id).success)
            return failure("識別子の形式が正しくありません")
        return {
            ok: true,
            command: { name, id, dryRun },
            ...(repo ? { repo } : {}),
        }
    }
    if (dryRun && name === "status")
        return failure("status では --dry-run を使えません")
    if (noDeploy && name === "status")
        return failure("status では --no-deploy を使えません")
    if (env !== "production" && env !== "develop")
        return failure("--env に production または develop を指定してください")
    if (name === "status") {
        if (positionals.length) return failure("余分な引数があります")
        return { ok: true, command: { name, env }, ...(repo ? { repo } : {}) }
    }
    const id = positionals[0]
    if (!id) return failure(`${name} に識別子を指定してください`)
    if (!idSchema.safeParse(id).success)
        return failure("識別子の形式が正しくありません")
    return {
        ok: true,
        command: { name, id, env, deploy: !noDeploy, dryRun },
        ...(repo ? { repo } : {}),
    }
}
