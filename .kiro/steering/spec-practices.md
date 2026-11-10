# spec を作るときの守り方

cc-sdd の skill の `rules/`（EARS・レビューのゲート・タスクの書式）は、メインのチェックアウト（`.claude/skills/kiro-*/rules/`）にだけ入る。worktree には無いので、worktree 内で探して「rules が無い」と判断しない。

## 守ること

- 複数の spec にまたがる作業は、discovery の成果物（`roadmap.md` と新規 spec ごとの `brief.md`）を先に書く。会話や記録だけに分割を残さない。`kiro-discovery` は `disable-model-invocation` なので、その手順の書式で自分で書く。
- 既存の旧様式を引き継がない。
  - コンポーネントに `D-1` のような旧 ID を付けない。
  - tasks に関数名・ファイルパスを書かない。
  - tasks にドキュメント更新のタスクを置かない（design の Modified Files に書く）。
  - テストを別タスクにせず、実装タスクに含める。
  - 「テストが〜する」という要件を作らない（検査は design の Testing Strategy と tasks）。
  - 設計の追跡表は、要件 ID を範囲（1.1–1.10）でなく 1 つずつ書く。
- spec を作る・直すときは、まずメインの rules を読み、機械的な検査（ID の網羅・EARS・境界の節）を通してからレビューに出す。
- タスクグラフのサニティレビューは、独立したサブエージェントで行う。
- develop に取り込む圧縮コミットの題は 1 行にする（本文なし）。

## 承認方針

レビューのゲート（独立サブエージェント・機械検査・spec 間の整合レビュー）は省略しない。詳細設計へのこだわりは、要件とアーキテクチャに齟齬がなければ求めない（自動承認 `-y`・`kiro-spec-batch` を使う）。

worktree で `kiro-spec-batch` を使うときは、メインの `.claude/skills/kiro-*` を worktree の `.claude/skills/` へ複製する（gitignore 対象。サブエージェントが相対パスで SKILL.md を読むため）。
