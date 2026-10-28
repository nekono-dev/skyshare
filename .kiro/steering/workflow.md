# 開発の進め方

## 仕様駆動開発（cc-sdd）

仕様駆動開発は [cc-sdd](https://github.com/gotalab/cc-sdd) に従う。skill（`/kiro-*`）は `.claude/skills/` に、テンプレートは `.kiro/settings/` に、セッション開始時のフック `.claude/hooks/install-cc-sdd.sh` が固定バージョンで導入する（skill はリポジトリに含めない）。`CLAUDE.md` と `.kiro/settings/`（テンプレート）は cc-sdd の標準を追跡し、プロジェクトに合わせて調整してよい。

| 成果物                                                          | 場所                                             |
| --------------------------------------------------------------- | ------------------------------------------------ |
| 仕様（`spec.json`・`requirements.md`・`design.md`・`tasks.md`） | `.kiro/specs/<機能名>/`                          |
| プロジェクトの規約（steering）                                  | `.kiro/steering/`                                |
| システム全体の構成                                              | `docs/architecture.md`・`docs/architecture/*.md` |

### 流れ

1. 機能の新規追加・修正に着手する前に、`/kiro-discovery`（要否の判断）→ `/kiro-spec-init` → `/kiro-spec-requirements` → `/kiro-spec-design` → `/kiro-spec-tasks` で仕様を整える。各段階の承認は `spec.json` の `approvals` で管理し、**承認は人が行う**
2. 実装は `/kiro-impl`、検証は `/kiro-validate-impl`・`/kiro-verify-completion` を使う
3. 仕様の言語は日本語（`spec.json` の `language` は `ja`）

### 方針

- 仕様にない作業を禁止する仕組みではない。突発的なバグ修正などは仕様を経ずにコードを変更してよい。ただし、その変更が既存仕様の要件・設計と食い違うなら、同じ変更の中で該当の仕様を更新する（乖離は後から誰も気づけなくなるため）
- 仕様 → 実装の整合は強制してよいが、実装 → 仕様の網羅は強制しない
- 仕様書に進捗管理（「TODO」「検討中」「未定」など）を書かない。進捗は `tasks.md` のチェックボックスと `spec.json` が持つ
- 要件・設計に未確定の点があれば、着手前に利用者へ確認して解消する。推測で進めない
- 仕様・steering の整形は prettier で検査する（`npm run test:docs`。修正は `npx prettier --write .kiro/specs .kiro/steering docs`）

## ブランチとプレビュー

運用は skill `branch-release-workflow` に従う。正本は `.claude/branch-release-workflow.json`（作業ブランチ `dev/*`、`develop`、保護ブランチ `main`）。

- 新機能の実装・要望追加・要件追加の依頼を受けたら、作業前に `brw create <名前>` で作業ブランチを作る。`git checkout -b` などで直接作らない
- 保護ブランチと宣言外のブランチでの commit・push は、プラグインの PreToolUse フックが拒否する
- `develop` と `main` は、マージコミットだけで構成されるブランチとして保つ。作業ブランチ（`dev/*`）のコミットは、`develop` へ取り込む前に `develop` の先頭へ rebase し、1つのコミットに圧縮してから `--no-ff` でマージする（`develop` や `main` へ通常のコミットを直接積まない）
- `develop` へ取り込む圧縮コミットのメッセージは、題のみの1行（可能な限り短く）とし、本文は書かない（Co-Authored-By などの付記は除く）
- `develop` へのマージのタイミングは、利用者が指示する
- 作業ブランチへの commit・push は許可を求めずに行う。worktree は push しただけでは片付けず、`develop` へのマージ後（または `main` への PR 作成後）に `brw finish`（取り込み済みをまとめて片付けるなら `brw finish --merged`）で片付ける。続きの作業は `brw resume <ブランチ>`、新しい作業は `brw create <名前>` で始める
- 利用者が製造したコードの挙動を確認したい旨を示したら、`brw url` が返す `https://XXXX.develop.skyshare.nekono.dev` を案内する。`*.workers.dev` や version-id 形式の URL は案内しない

## main への取り込み前のアンケート除去

main へのマージまたは取り込みを依頼されたら、マージ前にローカルで `npm run survey -- prune` を実行し、結果の1行を利用者に報告する。手順や結果の読み方は [survey-run スキル](../../.claude/skills/survey-run/SKILL.md) を参照する。

本番配備はビルド時に `SURVEY_CONFIG` を読み込むため、除去で変数が更新された場合、その更新が本番配備のビルドより先に反映されるようにする。除去と回答データの確認には運営者のローカル認証済み CLI を使う。CI に変数の書き込み権限は与えない。

除去に失敗した場合、または回答データを確認できず対象が保持された場合は、その旨を報告する。失敗時は設定の元を変更せず、確認不能の対象も保持したまま、利用者へ状況を伝えてマージを続けられる。

## UI 実装の検証

UI に関わる変更（`.tsx`・`.astro`・`.css`・コンポーネント・画面・ページ）は、`tsc` や `vitest` に加えて、Playwright によるヘッドレスブラウザでの実動作確認を完了条件に含める。型検査や単体テストが通っても、実ブラウザでの操作後の表示が正しいとは限らないためである。

- テストは `tests/e2e/<名>.spec.ts` に置き、操作（クリック・入力・タブ切り替えなど）の後の DOM・表示内容を検証する。`curl` での SSR 出力確認や `--dump-dom` の静的スナップショットだけでは不十分である
- テスト資産は恒久的に残し、リグレッション防止に再利用する
- ログインなど外部要因で自動化できない確認は、手動確認の手順を tasks に書いた上で、自動化できる範囲を Playwright で確認する
- ログイン不要のゲスト表示（`?guest`、`src/lib/guestMode.ts`）を使うと、実アカウントなしで UI の状態遷移を検証できる

---

_cc-sdd 自体の使い方は `/kiro-*` skill の説明に従う_
