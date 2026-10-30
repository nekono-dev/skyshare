# Codex の導入と運用

会話・説明・ドキュメント・コメントは日本語にする。共通の実装規則と開発上の制約は CLAUDE.md を読む。Codex の自動読込用エントリは AGENTS.md。

## 共有skill

branch-release-workflow の本体は skyshare に置かず、GitHub の `nekono-dev/branch-release-workflow` から取得する。

```sh
npm run setup:brw
export BRW_PLUGIN_DIR="$(node hack/setup-brw.mjs)"
node "$BRW_PLUGIN_DIR/scripts/brw.mjs" check --branches-only
```

取得元と追跡ブランチは `.branch-release-workflow-source.json` に集約し、ローカルと全CIで同じブランチの最新コミットを使う。`npm run setup:brw` は外部の `~/.cache/skyshare/brw` へ fetch / checkout し、`.agents/skills/branch-release-workflow` からリンクする。共有skillの変更が選択したブランチへ取り込まれたら、セットアップを再実行して更新する。skill本体・生成リンクはcommitしない。

新しい clone / worktree / クラウド環境でもこの準備を行う。skillが探索されないときは `$BRW_PLUGIN_DIR/SKILL.md` を直接読む。テスト・型検査の前提は DEVELOP.md の「テスト・型検査と作業ブランチの worktree の準備」に従う。

本番用テンプレートは `previews_enabled: false` で、develop配備時の設定生成で `true` に切り替わる。ブランチとCIの整合は `check --branches-only` で検査する。通常の `check` はプレビュー用の生成済み設定も検査し、本番テンプレートだけでは未設定エラーを報告する。

## 作業手順

- ブランチ宣言の正本は `.branch-release-workflow.json`。Claude の旧パスは同じファイルへのシンボリックリンクであり、別々の値を置かない。
- 新しい作業は `node "$BRW_PLUGIN_DIR/scripts/brw.mjs" create <名前>` で開始し、表示された worktree で編集する。続きは `resume <ブランチ>` を使う。
- Claude の PreToolUse フックは Codex では自動実行されない。commit・push の直前に、同じ CLI の `guard "実際に実行するgitコマンド"` を実行し、終了コード0の場合だけそのコマンドを実行する。例: `node "$BRW_PLUGIN_DIR/scripts/brw.mjs" guard "git push -u origin dev/example"`。この判定は手順によるもので、Git自体の強制的な保護ではない。
- `main`・`release/**` と宣言外のブランチには通常の作業でcommit・pushしない。作業ブランチへのcommit・pushは許可を求めずに行う。
- 実装確認を求められたらcommit・pushし、`brw url` のURLを案内する。CIの反映状況も確認する。
- pushしただけではworktreeを削除しない。取り込み後の片付けは `finish`、再開は `resume` を使う。

## リリース運用

`dev/*` → `develop` の確認・取り込みは従来どおり。`develop` / `main` のマージ方法は CLAUDE.md に従う。

本番はユーザーがリリースを依頼した場合だけ、確定した対象コミットから `release/XXX` を切り出してpushする。命名・対象コミットが不明なら確認する。保護ブランチへの通常のcommit・pushを許可するために宣言を緩めない。通常作業用の `brw guard` はリリースへのpushを拒否するため、本番リリースの作成・pushは明示的なリリース依頼に基づく別の操作として行う。

`release/*` はすべて同じ本番環境へ配備される。古いリリースブランチへのpushは本番を古い版へ戻す可能性があるため、新しいリリース名を使う。`main` へのpushは本番デプロイを起動しない。`develop` と `dev/*` のCIは維持する。
