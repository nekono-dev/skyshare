---
name: branch-release-workflow
description: 本番向けブランチ（main など）での直接作業を防ぎ、作業ブランチ（dev/XXXX など）で作業させるとき、作業ブランチの push でプレビュー・本番ブランチの push で本番デプロイする CI/CD を整備・案内するとき、新機能の実装や要望追加で作業ブランチを作るとき、ユーザーが実装した挙動を確認したい（プレビューを見たい、動作確認したい）と言ったときに使う。ブランチ運用は宣言ファイル .claude/branch-release-workflow.json で決まり、リポジトリ固有の値はスキルに持たない。
---

# ブランチ運用とプレビュー/本番の CI/CD

運用の正本は、リポジトリ内の宣言ファイル `.claude/branch-release-workflow.json`。スキルにはリポジトリ固有の値を持たない。

```sh
node <スキルのパス>/scripts/brw.mjs <サブコマンド>
```

以下、`brw` は上記コマンドを指す。

## 開始時のスキル更新

このスキルを使い始めるとき（ブランチの作成・プレビューの案内・導入・整合検査に着手する前）に、最初に 1 回だけ、スキル自身を最新にする。

```sh
brw self-update
```

- スキルのディレクトリが git の作業ツリーの最上位なら `git pull --ff-only` で更新する。出力の 1 行を利用者に伝える
- 「更新しました」と出たときは、`SKILL.md` を読み直してから作業する
- 「更新できません」と出たとき（未コミットの変更・履歴の分岐・ネットワーク不通・git の作業ツリーでないコピー）は、強制せず（`reset`・`stash`・`--force` を使わない）、理由を利用者に伝えて現在の版のまま作業を続ける。プロジェクトにコミットして同梱したコピー（クラウドセッションなど）は更新できないのが通常なので、1 行伝えるだけでよい
- 同じ会話の中では繰り返さない。利用者が更新しないよう指示したときは行わない
- フックの判定（`hook`）は更新の対象外で、毎回その時点の版のスクリプトが動く

## 絶対ルール

- **保護ブランチ（`protectedBranches`）と、宣言外のブランチで、commit・push をしてはならない。** 作業は作業ブランチ（`workBranches`）で行う
- 作業ブランチの作成は `brw create` を使う。`git checkout -b` や `git worktree add` を直接使わない（命名規則の検証を通すため）
- commit は作業ブランチ上なら、リポジトリのスキルや CLAUDE.md に注意書きが無い限り許可なしでよい。**push は従来どおりユーザーの許可を得る**
- 宣言ファイルが無いときは、作業ブランチ運用が未整備ということなので、ユーザーに確認する（下の「導入」）
- 宣言が `develop` などを `workBranches` にしているリポジトリ（CI が無い等）では、そのブランチで作業してよい

## 宣言ファイル

`templates/config.example.json` を元に作る。

| キー | 内容 |
|---|---|
| `workBranches` | 作業ブランチの glob（`*` は `/` を除く、`**` は `/` を含む）。必須 |
| `protectedBranches` | 本番向けなど、直接作業を禁止するブランチ。保護の判定が先に効く |
| `baseBranch` | 作業ブランチの分岐元（既定 `develop`） |
| `namePattern` / `maxNameLength` | 作業ブランチ名の正規表現（接頭辞を含むブランチ名全体）と最大文字数 |
| `preview.provider` | `none` / `url-template` / `cloudflare-previews`。省略時は `urlTemplate` があれば `url-template` |
| `preview.urlTemplate` | `{alias}`（ブランチ名の `/` を `-` にしたもの）か `{branch}` を含むURL |

`preview` が無い、または `provider: none` ならプレビューURLの案内はしない。provider の詳細は `providers/`、Cloudflare の知見は `references/cloudflare-previews.md`。

## 1. 作業ブランチの作成

新機能・要望・要件の追加を依頼されたら、作業を始める前に作る。名前はユーザーの依頼から機能を表す短い英語名を自分で決めてよい。

```sh
brw create <名前> [--base <分岐元>] [--branch-only]
```

既定で worktree（`.claude/worktrees/<alias>`）も作る。`--branch-only` ならブランチだけ作る。作成後の作業は、そのブランチ（worktree）上で行う。

## 2. プレビューURLの案内

ユーザーが実装の挙動を確認したいと言ったら、commit 済みの作業ブランチを push（許可を得る）してから案内する。

```sh
brw url [ブランチ]
```

- 案内するのは `brw url` が返すURLのみ。CI の出力に別のURL（`workers.dev` など）が出ても案内しない
- push 直後は CI 完了まで反映されない。`gh run list` などで状況を確認し、未完了ならそう伝える
- 命名規則に合わないブランチはプレビューが発行されない。その旨を伝え、合うブランチへ移すことを提案する

## 3. 整合検査・雛形・後始末

```sh
brw check                         # 宣言・workflow・provider 設定の整合検査
brw gen-workflow [--write]        # provider の preview workflow 雛形（--write で .github/workflows/preview.yaml を作成。既存は上書きしない）
brw cleanup <ブランチ> [--execute] # provider 固有の後始末（既定は表示のみ）
```

`check` は、宣言の `workBranches` / `protectedBranches` に含まれないのに push で CI が走るブランチ指定を警告し、provider ごとの設定（例: Cloudflare の `previews_enabled`、wrangler のバージョン）も調べる。

**機械判定できないこと**: workflow が本番向けか（`wrangler deploy` か preview か等）という意味と、リポジトリ外の設定（Cloudflare Pages の本番ブランチ等）。これらはユーザーに確認する。`check` の警告は workflow の `on.push.branches` の簡易解析に基づく。

## 導入（宣言ファイルが無い、またはフックが未設定のとき）

1. 宣言ファイルを作る（値はユーザーに確認する。推測で埋めない）
2. **PreToolUse フック**を、リポジトリの `.claude/settings.json` に入れる。内容は `templates/settings.hook.json`。settings.json の変更なので、**設定内容をユーザーに示して承認を得てから**入れる
3. スキルを `.claude/skills/branch-release-workflow` に置く（フックのパスがここを指す）。プロジェクトへコミットして同梱すると、クラウドセッションでも追加の準備なしに動く
4. `node tests/selftest.mjs` で判定ロジックを確認できる

手元では `git clone` で置いて `self-update` で更新し、更新分をプロジェクトへコミットする運用ができる。同梱コピーだけの環境（クラウドセッション）では更新されず、コミットされた版で動く。`brw` はスキルのディレクトリ内のスクリプトで、PATH やグローバルには何も導入しない。

フックは `git commit` / `git push` の前に判定する。保護ブランチ・宣言外ブランチは deny、宣言ファイルが無い・不正・ブランチを特定できない・`--all`/`--mirror` は ask。`git checkout -b` と `git worktree add` はフックの対象外（このスキルの手順で守る）。

## 注意

- フックは Bash の `git commit` / `git push` のみ見る。他の経路（スクリプト内部の git など）は防げない
- プレビューが本番データに届かないかはリポジトリ側の設定次第。案内時に必要なら補足する
