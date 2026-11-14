# Brief: survey-operations

## Problem

アンケートの運用（登録・状態確認・期限切れの除去）は、現行の CLI（`hack/survey-cli`、`npm run survey`）と `survey-run` skill に分かれている。結果の公表が加わると、公開の切り替えが要り、さらに「回答の削除は Worker が行う」ため、現行の除去の判定（D1 の行の有無）が意味を失う。運用者が状態を一目で把握し、安全に操作できる体系に見直す必要がある。

## Current State

- CLI: `hack/survey-cli/{cli,config,lifecycle,remote}.ts`。コマンドは `add --file <パス> [--dry-run]`・`status`・`prune [--dry-run]`。`--repo owner/repo` を取る。出力は固定の 1 行。
- 設定の置き場: GitHub のリポジトリ変数 `SURVEY_CONFIG`（`gh variable`）。CI が配備の前に静的ファイル `public/surveys/index.json` を生成する（`npm run survey:render`）。CI に変数の書き込み権限は与えない。
- 段階: `upcoming`・`active`・`retained`・`expired`（`lifecycle.ts`）。除去は `expired` かつ D1 の本番・develop の 2 表に行が無いものだけ（`remote.ts` が wrangler で SELECT）。
- 手順: `.claude/skills/survey-run/SKILL.md`（聞き取り・翻訳・確認・登録・状態・除去）。`docs/DEVELOP.md` の 3.2 と main への取り込み前の `prune` の手順（243 行付近）。

## Desired Outcome

- コマンドは平坦にそろえる（ユーザーの決定 2026-11-12）: `add`・`status`・`publish <id>`・`unpublish <id>`・`prune`・`remove <id>`。
- `status` は設定の状態と R2 の状態を 1 つの表にし、アンケートごとに 1 つの段階を示す: `upcoming`（開始前）→ `active`（開催中）→ `closed`（終了・集計待ち）→ `empty`（回答 0 件）・`hidden`（集計済み・非公開）→ `published`（公開中）。回答 0 件で削除済みのものの段階名は設計で決める。
- 新規登録は UUID v4 を自動発行し、同時に開催できるアンケートを 1 つに制限する。開始前も次の新規登録を止め、設定に残る集計済みの過去分は妨げない。
- 締切は実在する日付だけを受け付け、日本時間 0 時に変換する。
- `publish`・`unpublish` は R2 の統計ファイルの可視フラグを書き換え、続けて対象環境の配備を起動する（`gh workflow run`。結果ページが静的生成のため、反映に再配備が要る。ユーザーの決定 2026-11-12）。集計前（`closed` 以前）のものは拒否する。
- 配備の起動: `--env develop` は `deploy.yaml` を `develop` ブランチで、`--env production` は最新の `release/*` ブランチで起動し、`dry_run` を偽にして渡す。起動は運用者のローカル認証の `gh` で行い、CI に追加の権限を与えない。対象の `release/*` の決め方（最新の判定）と、配備を起動しない指定（`--no-deploy`）の要否は設計で決める。
- `status` は、可視フラグの状態に加えて、公開の反映が配備待ちかを示せるか設計で決める。
- `prune` は、終了済みで本番・develop 両方の目録に識別子があるアンケートだけを `SURVEY_CONFIG` から除去する。D1 の行は確認しない。
- `remove <id>` は開始前の取り下げに使う。開催中は拒否し、強制指定は持たない。終了済みは両環境の目録に識別子があるときだけ除去する。開催中の取り下げは締切の前倒し、両環境への配備、日次集計、両環境での状態確認の後に行う。
- `status`・`publish`・`unpublish` は `--env production|develop` を必須にする（プレビューは develop と共用）。`prune`・`remove` は `--env` を取らず両環境の目録を読む。`add` は環境を分けない。
- `survey-run` skill と `docs/DEVELOP.md` の手順を新しい体系に合わせる。

## Approach

現行の CLI の構造（引数の検証 → 設定の取得 → 変換 → 比較 → 反映、`status` は表全体・その他は固定の 1 行、秘密や設定本文を出さない）を保ち、R2 の読み書き（`wrangler r2 object` など）の部品を `remote.ts` に足す。段階の判定は純粋関数（時刻と R2 の状態を引数に取る）にする。`prune` の判定を D1 の行から R2 の集計の有無に置き換える。

## Scope

- **In**: コマンド体系（add・status・publish・unpublish・prune・remove）、`status` の段階の定義と表示、R2 の読み書きの部品、`--env` の扱い、`survey-run` skill の更新、`docs/DEVELOP.md` の手順の更新、CLI の置き場の判断（現在の `hack/survey-cli` のままか）、出力の固定と秘密の非表示の規則の維持。
- **Out**: 集計・統計ファイルの形式・Worker の削除（`survey-results-aggregation`）、API・画面（`survey-results-public`）、アンケートの定義の形式（`surveys`）、`survey:render`（設定の静的ファイルの生成）。

## Boundary Candidates

- コマンドの解析と出力（`cli.ts`）
- 設定の操作（`config.ts`: add・remove・prune の変換）
- 段階の判定（`lifecycle.ts`: 設定の期間と R2 の状態から決める純粋関数）
- 外部の操作（`remote.ts`: gh による変数、wrangler による R2）
- 運用の手順書（skill・DEVELOP.md）

## Out of Boundary

- 統計ファイルの形式・集計・削除
- 結果の閲覧の画面

## Upstream / Downstream

- **Upstream**: `survey-results-aggregation`（統計ファイルの形式・R2 のオブジェクトの構成・可視フラグ）、`surveys`（設定の形式 `SurveyConfigSchema`）。
- **Downstream**: なし（運用者と `survey-run` skill が使う）。

## Existing Spec Touchpoints

- **Extends**: `ops-tooling-layout`（`hack/` と `scripts/` の置き方）、`develop-docs`（DEVELOP.md の手順）。
- **Adjacent**: `ops-config-secrets`（設定と秘密の扱い）、`ops-agent-setup`（skill の導入）。

## Constraints

- `status` は複数行の表全体を返し、それ以外は固定の 1 行だけを返す。設定本文・回答・認証情報・外部コマンドの標準エラーを出さない。
- CI に変数の書き込み権限を与えない。変更はすべて運用者のローカルの認証済みの CLI で行う。
- 公開の切り替えは本番を意図せず操作しないよう、`--env` を省略させない。
- `prune`・`remove` は `--env` を取らず、常に本番と develop の両方の目録を読む。`status`・`publish`・`unpublish` は `--env` 必須のままとする。
- 新規登録の識別子は CLI が `node:crypto` の `randomUUID()` で UUID v4 を発行する。月ごとの連番、運用者が指定する新規識別子、内容が同じ下書きから既存識別子を探す方法は使わない。下書きに識別子があれば、設定にあるアンケートの更新だけに使い、無ければ `error: not-found` で何も変更しない。
- 同時に開催できるアンケートは 1 つだけ。新規登録は、設定にあるすべての識別子が本番・develop 両方の目録に記録されるまで拒否する。開始前のものも対象だが、設定に残る集計済みの過去分は妨げない。D1 には問い合わせない。目録の無いキーは空として扱い、取得失敗・形式不正は dry-run を含め登録を失敗させる。
- 拒否時は `error: refused: 未集計のアンケートがあります。集計を待つか、開始前なら remove、開催中なら締切を前倒しして両環境へ配備し、集計を待ってください。` の 1 行だけを返す。
- 締切は実在する `YYYY-MM-DD` の日付だけを受け付け、日本時間の 0 時を示す ISO 8601 に変換して保存する。新規は登録時刻より後、更新は元の開始日時より後でなければならない。集計は日次のままとする。
- 開催中の `remove` は拒否し、強制指定は設けない。開催中は同じ識別子の `add` 更新で締切だけを前倒しする。前倒し先は元の開始日時より後で最も早い日本時間 0 時とし、その日時が現在の締切以後で前倒しにならない場合（1 日だけのアンケートや当日開始など）は `error: refused: 前倒しできません。自然な終了と集計を待ってください。` と固定の 1 行で拒否する。更新設定を両環境へ配備し、日次集計を待ち、両環境の `status --env` で `empty`・`hidden`・`published` のいずれかを確認してから `remove` または `prune` する。除去時にも両方の目録を読み直す。設定更新だけでは配備済みの受付は止まらない。終了済みの再開と、いずれかの環境で集計済みのアンケートの締切変更は拒否する。集計済みは識別子の有無だけで判定し、期間の一致を条件にしない。
- 既存の `survey-run` の運用の規則（日本語のみの入力・確認前に登録しない・一時ファイルの削除）を保つ。ただし、アンケート全体の題・説明は設定の形式から廃止される（`surveys` の更新）ため、聞き取りと確認表から「タイトル・説明」を外し、質問ごとの題だけにする。
- `status` の表示は、題が無くなるため ID を主にする（必要なら最初の質問の題を補う。設計で決める）。
- アンケート機能は本番へ未公開のため、破壊的変更を許す（利用者の決定 2026-11-12）。運用中の `SURVEY_CONFIG` と D1 は初期状態として扱い、移行の手順は作らない。下書きの形式（`tests/fixtures/survey-operation/drafts/`）を新しい形式に直し、運用中の設定は作り直す（現在の設定の題「Skyshare v1 と v2 どちらの UI が好みか」は、質問の題「UIデザインはどちらが好みですか？」に置き換える。設定の更新は、設定の形式の変更の実装後に CLI で行う）。
- 既存のテスト（`tests/` の CLI のテスト）を、新しい体系に合わせて更新する。

## 設計での調整（2026-11-13）

- `prune`・`remove` は `--env` を取らず、常に両方の環境の目録を確認する（`design.md` の Decision 6）。`status`・`publish`・`unpublish` は `--env` 必須のまま。新規識別子は UUID v4、同時開催は 1 件、締切は日付だけの日本時間 0 時指定とし、開催中は締切を前倒しして集計を待つ。
