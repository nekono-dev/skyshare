/**
 * ビルドの版・コミット・リポジトリの解決（純粋関数）。
 *
 * 責務と処理概要:
 * - CI（GitHub Actions の `GITHUB_SHA`・`GITHUB_REPOSITORY`）の値を優先し、なければ手元の Git の値から、
 *   ビルドしたコミットとソースコードのリポジトリ（`owner/repo`）を決める。
 * - 不具合の報告に、動作中のビルドを特定できる情報を載せるために使う。
 * - `import.meta.env` と Node 固有の API に依存しない。`astro.config.mjs`（Node）からも読み込める
 *   （Git の値の読み出し自体は `astro.config.mjs` が行い、ここには文字列で渡す）。
 */

export type BuildInfo = {
    /** パッケージの版（`PUBLIC_VERSION`）。未設定なら "unknown" */
    version: string
    /** ビルドしたコミットの40桁の16進。判定できなければ null */
    commit: string | null
    /** ソースコードのリポジトリ（`owner/repo`）。判定できなければ null */
    repository: string | null
}

type Env = Record<string, string | boolean | undefined>

const COMMIT = /^[0-9a-f]{40}$/
const SLUG = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/

const read = (env: Env, name: string): string => {
    const value = env[name]
    return typeof value === "string" ? value.trim() : ""
}

/**
 * Git のリモートの URL から、GitHub のリポジトリの `owner/repo` を取り出す。
 *
 * 想定する入力形状:
 * - `git@github.com:owner/repo(.git)` か `https://github.com/owner/repo(.git)`
 *   （`https://user@github.com/...` のような認証情報つきも許す）
 *
 * Input:
 * - `remoteUrl`: `git remote get-url origin` の出力
 *
 * Output:
 * - `owner/repo`。GitHub 以外か形式が違えば null
 *
 * 例:
 * - 入力: "git@github.com:nekono-dev/skyshare.git" → 出力: "nekono-dev/skyshare"
 * - 入力: "https://gitlab.com/a/b" → 出力: null
 */
const parseRepositorySlug = (remoteUrl: string): string | null => {
    const match =
        /^(?:git@github\.com:|https:\/\/(?:[^@/]+@)?github\.com\/)([^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(
            remoteUrl.trim(),
        )
    const slug = match?.[1] ?? ""
    return SLUG.test(slug) ? slug : null
}

/**
 * ビルドの版・コミット・リポジトリを決める。
 *
 * 処理の趣旨:
 * - CI の値があればそれを使う（CI は push されたコミットを確実に知っているため）。
 * - なければ Git の値を使い、どちらも形式に合わなければ null（不明）とする。
 *
 * Input:
 * - `env`: 環境変数（`PUBLIC_VERSION`・`GITHUB_SHA`・`GITHUB_REPOSITORY` を読む）
 * - `git`: 手元の Git の値（`sha` は `git rev-parse HEAD`、`remoteUrl` は `git remote get-url origin`）
 *
 * Output:
 * - 解決した `BuildInfo`
 *
 * 例:
 * - 入力: `({ GITHUB_SHA: "<40桁>", GITHUB_REPOSITORY: "o/r" }, {})` → 出力: `{ commit: "<40桁>", repository: "o/r", ... }`
 * - 入力: `({}, {})` → 出力: `{ version: "unknown", commit: null, repository: null }`
 */
export const resolveBuildInfo = (
    env: Env,
    git: { sha?: string; remoteUrl?: string },
): BuildInfo => {
    const ciCommit = read(env, "GITHUB_SHA").toLowerCase()
    const gitCommit = (git.sha ?? "").trim().toLowerCase()
    const commit = [ciCommit, gitCommit].find(value => COMMIT.test(value))

    const ciRepository = read(env, "GITHUB_REPOSITORY")
    const repository = SLUG.test(ciRepository)
        ? ciRepository
        : parseRepositorySlug(git.remoteUrl ?? "")

    return {
        version: read(env, "PUBLIC_VERSION") || "unknown",
        commit: commit ?? null,
        repository,
    }
}
