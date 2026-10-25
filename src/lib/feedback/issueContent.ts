/**
 * 不具合の報告と機能の提案から、GitHub の Issue の件名・本文・ラベルを組み立てる。
 *
 * 責務と処理概要:
 * - 種別でラベル（bug / enhancement）と本文の節を切り替える。
 * - 本文に、入力の本文・報告者（ハンドルと DID）・ビルドの版とコミット・環境の情報を載せる。
 * - Issue は公開のリポジトリに作られるため、利用者の入力はメンション・リンク・画像・HTML として
 *   解釈されない形（閉じられない囲いのコードブロック・インラインコード）で載せる。
 * - 本文の見出しと項目名は、開発者が読むため日本語に固定する（表示言語に依存しない）。
 */
import type { RequestBodyType } from "@/lib/api/schema/v2/feedback/post"
import type { Reproducibility } from "./limits"

export type IssueReporter = { did: string; handle: string }
export type IssueBuild = {
    version: string
    commit: string | null
    /** Issue を作るリポジトリ（`owner/repo`）。コミットのリンクにも使う */
    repository: string
}
export type IssueContent = {
    title: string
    body: string
    labels: ["bug"] | ["enhancement"]
}

const REPRODUCIBILITY_LABELS: Record<Reproducibility, string> = {
    always: "毎回起きる",
    sometimes: "ときどき起きる",
    no: "起きない",
    untested: "試していない",
}

/**
 * 利用者の文章を、入力で閉じられないコードブロックにする。
 *
 * 処理の趣旨:
 * - 入力の中で最も長いバッククォートの連続より1つ長い囲い（最短3つ）を使い、入力が囲いを閉じられないようにする。
 * - コードブロックの中では、メンション・リンク・画像・HTML が解釈されない。
 *
 * Input:
 * - `text`: 利用者の文章
 *
 * Output:
 * - 言語 text のコードブロックの Markdown
 *
 * 例:
 * - 入力: "a ``` b" → 出力: "````text\na ``` b\n````"
 */
export const fencedBlock = (text: string): string => {
    const longest = Math.max(
        0,
        ...Array.from(text.matchAll(/`+/g), match => match[0].length),
    )
    const fence = "`".repeat(Math.max(3, longest + 1))
    return `${fence}text\n${text.replace(/\r\n?/g, "\n")}\n${fence}`
}

/**
 * 短い値を、インラインコードにする。
 *
 * 処理の趣旨:
 * - バッククォートと改行を除き、インラインコードを閉じたり行を崩したりできないようにする。
 *
 * Input:
 * - `text`: 載せる値（識別文字列・ハンドルなど）
 *
 * Output:
 * - `` `値` `` の形の Markdown。空なら「不明」
 *
 * 例:
 * - 入力: "Mozilla/5.0 `x`" → 出力: "`Mozilla/5.0 x`"
 */
export const inlineValue = (text: string): string => {
    const value = text.replace(/[`\r\n]/g, "").trim()
    return value === "" ? "不明" : `\`${value}\``
}

/**
 * コミットを、リポジトリのコミットのページへのリンクにする。
 *
 * Input:
 * - `commit`: 40桁の16進。null なら不明
 * - `repository`: `owner/repo`
 *
 * Output:
 * - `[先頭7文字](https://github.com/owner/repo/commit/<commit>)`、null なら「不明」
 */
const commitLink = (commit: string | null, repository: string): string =>
    commit
        ? `[${commit.slice(0, 7)}](https://github.com/${repository}/commit/${commit})`
        : "不明"

/**
 * 報告か提案の入力から、Issue の件名・本文・ラベルを組み立てる。
 *
 * 処理の趣旨:
 * - 件名は空白の連続（改行を含む）を1つの空白にして1行にする。
 * - 技術的な補足を省いた提案は、補足の節ごと載せない。
 * - 画面の版とコミットがサーバーと異なるときだけ、画面の値も並べる
 *   （ホーム画面のアプリが古い画面を表示し続けている場合を見分けるため）。
 *
 * Input:
 * - `input`: 検証済みの入力
 * - `reporter`: ログインのセッションのアカウント
 * - `build`: 受け付けたサーバーのビルドの値
 *
 * Output:
 * - `IssueContent`
 *
 * 例:
 * - 入力: `({ kind: "bug", title: "落ちる\n", ... }, { did, handle }, build)`
 * - 出力: `{ title: "落ちる", body: "## 不具合の報告\n...", labels: ["bug"] }`
 */
export const buildIssue = (
    input: RequestBodyType,
    reporter: IssueReporter,
    build: IssueBuild,
): IssueContent => {
    const sections: string[] = []
    if (input.kind === "bug") {
        sections.push(
            "## 不具合の報告",
            "### 操作した内容",
            fencedBlock(input.steps),
            "### もう一度操作して同じことが起きるか",
            REPRODUCIBILITY_LABELS[input.reproducibility],
        )
    } else {
        sections.push(
            "## 新機能の提案",
            "### どのような機能か",
            fencedBlock(input.description),
        )
        if (input.technicalNotes !== undefined) {
            sections.push("### 技術的な補足", fencedBlock(input.technicalNotes))
        }
    }

    const { environment } = input
    // ハンドルはインラインコードに入れ、GitHub のメンション（@ユーザー名）として解釈させない
    sections.push(
        "### 報告者",
        `- Bluesky: ${inlineValue(`@${reporter.handle}`)}（[${reporter.did}](https://bsky.app/profile/${reporter.did})）`,
    )

    const environmentLines = [
        `- Skyshare の版: ${inlineValue(build.version)}`,
        `- コミット: ${commitLink(build.commit, build.repository)}`,
    ]
    if (environment.version !== build.version) {
        environmentLines.push(`- 画面の版: ${inlineValue(environment.version)}`)
    }
    if (environment.commit !== (build.commit ?? "")) {
        environmentLines.push(
            `- 画面のコミット: ${inlineValue(environment.commit)}`,
        )
    }
    environmentLines.push(
        `- OS: ${inlineValue(environment.os)}`,
        `- ブラウザ: ${inlineValue(environment.browser)}`,
        `- PWA（ホーム画面から起動）: ${environment.standalone ? "はい" : "いいえ"}`,
        `- User-Agent: ${inlineValue(environment.userAgent)}`,
    )
    sections.push("### 環境", environmentLines.join("\n"))
    sections.push(
        "<sub>この Issue は Skyshare の不具合報告・機能提案のフォームから作成されました。</sub>",
    )

    return {
        title: input.title.replace(/\s+/g, " ").trim(),
        body: `${sections.join("\n\n")}\n`,
        labels: input.kind === "bug" ? ["bug"] : ["enhancement"],
    }
}
