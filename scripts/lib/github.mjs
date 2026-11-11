/**
 * `scripts/secrets/sync-github-variables.mjs` と `hack/survey-cli/remote.ts` が使う、Git リモート URL から GitHub の `owner/repo` を取り出す。
 */

/**
 * Git のリモートの URL から、GitHub のリポジトリの `owner/repo` を取り出す。
 *
 * Input:
 * - `remoteUrl`: `git remote get-url origin` の出力（`git@github.com.<別名>:o/r.git` の SSH の別名も許す）
 *
 * Output:
 * - `owner/repo`。判定できなければ null
 *
 * 例:
 * - 入力: "git@github.com.nekono:nekono-dev/skyshare.git" → 出力: "nekono-dev/skyshare"
 */
export const repositoryFromRemote = remoteUrl => {
  const match =
    /github\.com[^:/]*[:/]([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(
      remoteUrl.trim(),
    )
  return match ? match[1] : null
}
