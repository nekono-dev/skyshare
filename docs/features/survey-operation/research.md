# Research & Design Decisions

## Summary

- **Consulted Skills**: `kiro-spec-design` の `design-principles.md`（境界を先に定義し、純粋処理と入出力を分ける）、`design-discovery-light.md`（既存拡張点と互換性を調査）、`design-synthesis.md`（共通化・採用・簡素化を判断）、`design-review-gate.md`（要件追跡・境界・ファイル計画・実行可能性を点検）。
- **Feature**: `survey-operation`
- **Discovery Scope**: Extension（既存の `hack/` の配備用スクリプトと、cc-sdd・branch-release-workflow の作業手順に沿った運営の道具を足す。軽量な調査）
- **Key Findings**:
  - 設定の元 `SURVEY_CONFIG` はリポジトリ全体の GitHub 変数で、ビルド時に survey-definition の生成処理が読む。書き込みは `gh variable set`（標準入力で値を渡せる）、削除は `gh variable delete`。`GITHUB_TOKEN` は変数を書けないため、書き込みは手元の認証済みの `gh` に限る。
  - 本番の D1（`skyshare`）と develop の D1（`skyshare-develop`）は別で、名前は `wrangler.template.jsonc` の `database_name` と末尾の `-develop` で決まる（`hack/render-deploy-config.mjs` と同じ規則）。回答データの有無は、`wrangler d1 execute <名前> --remote --json --command` で読める。
  - `hack/sync-deploy-env.mjs` は `repositoryFromRemote`（git のリモートから `owner/repo` を得る）と `parseDeployEnv`（`deploy.env` の読み込み）を export している。リポジトリ判定と Cloudflare の認証情報の取得を再利用できる。
  - `.claude/skills/survey-run/` と `.agents/skills/survey-run/` は `.gitignore` の対象外である。`.claude` の cc-sdd 管理ファイルだけが除外され、運用スキルは両方とも Git 管理できる。
  - main へのマージは、branch-release-workflow（外部プラグイン。リポジトリ外）の流れで「develop から main への PR」として行う。プラグインは変更できないため、定型工程の置き場所はリポジトリの steering（`DEVELOP.md`）と、そこから参照するプロジェクトスキルになる。
  - 要件更新で開始日時は入力項目から外れた。現行の `config.ts`・`cli.ts`・`survey-run/SKILL.md` は下書きの `opensAt` を要求するため、純粋な設定編集に登録時刻を注入し、新規には保存し、既存 ID または同一内容・終了日時の再登録では既存時刻を再利用する設計へ合わせる。

## Research Log

### 要件更新後の開始日時の境界

- **Context**: 運営者が終了日時のみを決め、開始日時は設定の新規登録時に自動で決まり、内容更新では初回値を維持する要件へ変更された。
- **Sources Consulted**: `docs/features/survey-operation/requirements.md`（1.1、1.5、2.2、3.1、3.3、3.5、3.9）、`hack/survey/config.ts`、`hack/survey/cli.ts`、`.claude/skills/survey-run/SKILL.md`、`tests/hack/survey/config.test.ts`、`tests/hack/survey/cli.test.ts`、survey-definition の `Survey` 型と期間検証。
- **Findings**:
  - 現行の CLI は `DraftSurvey` の `opensAt` をそのまま検証・保存し、時刻注入は状態表示と除去候補判定だけに利用している。運営スキルも開始・終了の両方を聞いている。
  - 追加・更新を純粋に決める既存の `addSurvey` に CLI から `registeredAt` を明示して渡せば、システム時計への隠れた依存を避けながら決定論的テストを保てる。
  - 明示 ID の更新は保存済みの `opensAt` を引き継ぐ。ID なしの再登録は `opensAt` と `id` を除いた運営者指定内容・終了日時を比較し、一致時に既存 ID と初回時刻を引き継ぐ。新規のみ `registeredAt` を ISO 形式で保存する。
  - 期間検証は従来どおり survey-definition に委ねるため、終了日時が初回登録時刻以前なら追加は拒否され、設定の元は変わらない。
- **Implications**: 変更は `hack/survey/config.ts`・`hack/survey/cli.ts`・`survey-run/SKILL.md`・それぞれのテストに閉じる。外部依存や `SurveyConfig` の保存形式は変えず、`opensAt` の決定元だけを下書きから CLI に移す。

### 設定の元の読み書きの方法

- **Context**: 要件 3・5・7 は、CI に書き込み権限を預けずに変数を冪等に書き換えることを求める。
- **Sources Consulted**: `hack/sync-deploy-env.mjs`（`gh variable set` を標準入力で呼ぶ既存の流儀）、`gh variable` の CLI の仕様、survey-definition の design.md（`SurveyConfigRenderer` の入力の扱い）。
- **Findings**:
  - 既存のスクリプトは値をコマンドの引数に載せず標準入力で渡し、画面にも出さない。同じ流儀にする。
  - 変数が未設定のとき、`gh variable get` は「見つからない」旨で失敗する。認証切れなどの他の失敗と区別する必要がある。区別できない失敗は書き込みに進まない。
  - 空の設定の元はレンダラーで「未設定」と同じ扱いになる（survey-definition 5.2）。アンケートが 0 件の配列を有効とみなすかは仕様に無いため、0 件になるときは変数を削除する。
- **Implications**: 書き込みは「読む→変換→正規化→比較→書く／削除する」の 1 つの流れに集約できる。比較で同じなら書かない（冪等）。

### 回答データの有無の確認

- **Context**: 要件 5 は、回答の保持期限以後で、かつ行が残っていないアンケートだけを除くことを求める。
- **Sources Consulted**: survey-api の design.md（表 `survey_respondents`・`survey_answers`、`survey_id` が主キーの先頭、日次の削除は設定にあるアンケートだけが対象）、`hack/render-deploy-config.mjs`（D1 の名前の規則）。
- **Findings**:
  - 主キーの先頭が `survey_id` なので、`EXISTS (SELECT 1 FROM 表 WHERE survey_id = ?)` は 1 回の索引参照で済む。件数を数えるより読み取りが小さい。
  - `wrangler d1 execute` はパラメータの束縛を持たない。`survey_id` は survey-definition の識別子の規則（`^[a-z0-9]+(-[a-z0-9]+)*$`）を満たす検証済みの値だけを埋め込み、満たさない値は問い合わせずに失敗にする。
  - 日次の削除は設定にあるアンケートだけが対象なので、設定から先に消すとデータが残る（survey-api の運用の前提）。確認が取れない場合は除かない（フェイルセーフ）。
  - develop の D1 はプレビューの確認でも回答が入る。develop の Cron も同じ設定で削除するため、本番と develop の両方が 0 件になるまで設定に残す。
- **Implications**: 除去の判定は「期限切れ」と「全 D1 で 0 件」の積。確認の失敗は「0 件」ではなく「不明」として扱い、除かない。

### main へのマージの定型工程の置き場所

- **Context**: 要件 6 は、マージの手順の中で除去が運営者の指示なしに走ることを求める。
- **Sources Consulted**: `DEVELOP.md`、`.claude/branch-release-workflow.json`、branch-release-workflow の SKILL.md、`.claude/settings.json`。
- **Findings**:
  - プラグインは `.claude/settings.json` で有効化されるリポジトリ外の資産で、`main` への push・commit はフックが止める。マージの実体は develop から main への PR である。
  - 本番のビルドは、配備のワークフローの実行時に変数を読む。除去をマージより前に済ませれば、そのリリースが除去後の設定でビルドされる。
  - Claude は `CLAUDE.md` の steering 参照と `.claude/skills/`、Codex は `.agents/skills/` の repo-local skill から同じ手順を見つける。steering の `DEVELOP.md` に「main へ取り込む前に除去を実行する」を書き、両スキルが実行方法を持つ形が、プラグインに手を入れない最小の組み込みになる。
- **Implications**: 組み込み先は `DEVELOP.md` の新しい節。CI やフックには何も足さない。

### Claude・Codex のプロジェクトスキル配置

- **Context**: 同じアンケート運用を Claude と Codex の両方から起動するため、両方のネイティブなスキル探索先が必要。
- **Sources Consulted**: [OpenAI の Claude Agent SDK 移行ガイド](https://developers.openai.com/cookbook/examples/agents_sdk/migrate-from-claude-agent-sdk/readme)（Claude の `.claude/skills/*/SKILL.md` と OpenAI の `.agents/skills/*/SKILL.md` の対応）、[OpenAI の Codex OSS ワークフロー解説](https://developers.openai.com/blog/skills-agents-sdk)（repo-local skills と `.agents/skills/` の配置）、`.gitignore`、`git check-ignore`。
- **Findings**:
  - OpenAI の資料は、再利用可能な Claude skill を `.agents/skills/<name>/SKILL.md` に対応付け、Codex リポジトリ内 skills の配置先として `.agents/skills/` を示している。今回の追加は既存要件が示すエージェント非依存の施行ワークフローを別のネイティブ入口からも起動する設計判断であり、要件本文や操作契約は変えない。
  - Agent Skills の `name` と `description` が発見とルーティングのメタデータであり、skill 本文は起動後に読み込まれる。両ファイルで同じ `name: survey-run`・description・本文を使える。
  - 現行 `.gitignore` は `/.claude/skills/kiro-*` と `.cc-sdd-version` だけを除外し、`.agents/skills/survey-run/SKILL.md` は除外しない。今回調べた両パスの `git check-ignore` 結果は対象外。
  - 既存の `survey-run` の運用手順と `npm run survey` はホスト共通であり、Codex 用に別の CLI や設定経路を設ける必要はない。
- **Implications**: `.claude/skills/survey-run/SKILL.md` と `.agents/skills/survey-run/SKILL.md` を同じ frontmatter・手順本文で管理する。workflow は両方を案内し、`skillAndRule.test.ts` は両方の存在・追跡可否・本文一致・workflow 参照を確認する。

### 秘密値 SURVEY_HASH_KEY の扱い

- **Context**: 機能全体の前提に、既存の仕組みに乗るかの確認がある。
- **Findings**: 鍵の登録は survey-api の HashKeyProvisioning が `ensure-worker-secrets.mjs` と `prepare-local-env.mjs` の `GENERATORS` に載せて受け持つ。この spec の道具は鍵を読み書きしない。`deploy.env` の `[github.variables]` に `SURVEY_CONFIG` を書くと `npm run deploy:env` が古い値で上書きしうるため、雛形に書かず、運営の道具だけが書く旨をコメントで示す。
- **Implications**: `deploy.env.template` に注意書きを 1 つ足すだけで、シークレットの仕組みには触れない。

## Architecture Pattern Evaluation

| Option                                             | Description                                                         | Strengths                             | Risks / Limitations                                                               | Notes                              |
| -------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------- |
| 決定的な CLI＋定型スキル（採用）                   | 判断・検証・書き込みを CLI に寄せ、聞き取りと翻訳だけをスキルが担う | 再現性が高く、出力を 1 行に固定できる | CLI の入出力の契約を保つ必要がある                                                | 機能全体の合意に沿う               |
| スキルだけ（手順書のみで `gh`・`wrangler` を直接） | CLI を作らず、手順書に従って Claude がコマンドを組み立てる          | 実装が少ない                          | 毎回コマンドの組み立てがぶれ、冪等・検証漏れ・トークン消費が増える                | 登録ミス・削除漏れの解消にならない |
| CI で除去                                          | マージ時のワークフローが変数を書く                                  | 手元の操作が不要                      | `GITHUB_TOKEN` は変数を書けず、書ける権限を CI に預けることになる                 | 制約に反するため却下               |
| survey-api の Cron で除去                          | 日次の削除の後に変数も書き換える                                    | 削除と除去が連続する                  | Worker に GitHub の書き込み権限を預ける。設定の元がビルド入力であり再ビルドも要る | 責務の境界と制約に反するため却下   |

## Design Decisions

### Decision: Claude と Codex にネイティブな同名スキルを提供する

- **Context**: 現行の運用手順は Claude の `.claude/skills/` にだけあり、Codex から同じアンケート運用を直接起動できない。
- **Alternatives Considered**:
  1. Claude スキルのみを残し、Codex から Claude 固有ファイルを参照する
  2. `.claude/skills/survey-run/SKILL.md` と `.agents/skills/survey-run/SKILL.md` に同じ内容のネイティブスキルを置く
- **Selected Approach**: 2。両方で `name: survey-run`、同じ description・本文を使い、Claude は `.claude/skills/`、Codex は `.agents/skills/` のネイティブな場所から発見する。いずれも同じ CLI と `SURVEY_CONFIG` 契約を使う。
- **Rationale**: 各エージェントが標準の探索先から運用を起動でき、実処理を共有 CLI に集約したまま手順差を持たない。OpenAI の移行ガイドは `.claude/skills/*/SKILL.md` から `.agents/skills/*/SKILL.md` への対応を示す。
- **Trade-offs**: 同じ内容を 2 ファイルに置くため更新時の同期が必要。`skillAndRule.test.ts` で本文の一致、両方の存在・Git 管理、workflow の参照を検査する。
- **Follow-up**: skill の説明・確認フロー・CLI 呼び出しを両ファイルで一致させる。

### Decision: 開始日時は CLI が初回登録時に決定し、更新では保存値を維持する

- **Context**: 運営者が決めるのは終了日時であり、開始日時を含む運営者入力はなくす。survey-definition の保存契約には引き続き開始・終了の両方が必要である。
- **Alternatives Considered**:
  1. スキル側で開始日時を生成し下書きに含める
  2. `SurveyCli` が時刻を一度取得し、純粋な `SurveyConfigEditor` に明示して渡す
- **Selected Approach**: 2。新規登録では CLI が渡した時刻を UTC ISO 形式で `opensAt` に設定する。明示 ID 更新では既存 `opensAt` を維持する。ID なしでは `opensAt`・ID 以外の内容と `closesAt` が一致する既存アンケートを再利用し、初回 `opensAt` を保つ。
- **Rationale**: 開始時刻を機械的に一か所で決め、翻訳スキルが日時を捏造することを避ける。時刻引数の注入により再実行とテストの決定性を維持する。
- **Trade-offs**: 終了日時が登録時刻以前の場合は既存の survey-definition の期間検証で拒否される。既存更新で初回時刻より前の開催開始を求める場合は、この要件の範囲では扱えない。
- **Follow-up**: CLI と純粋関数の契約、聞き取り表、初回追加・明示 ID 更新・ID なしの同一入力再登録のテストを同時に更新する。

### Decision: 書き込みは 1 つの流れ（読む→変換→正規化→比較→書く）に集約する

- **Context**: `add` の冪等性と `prune` の冪等性は、どちらも「変数を読み、変換し、同じなら書かない」で成り立つ。
- **Alternatives Considered**:
  1. 操作ごとに別々の書き込み処理を持つ
  2. 共通の変換適用の流れに、操作ごとの変換だけを渡す
- **Selected Approach**: 2。変換は純粋関数（アンケートの追加、アンケートの除去）、流れは CLI が持つ。
- **Rationale**: 比較・容量の確認・0 件のときの削除・dry-run の挙動が 1 か所に揃い、テストも 1 か所で済む。
- **Trade-offs**: 流れが 1 つなので、操作ごとの特殊な書き込みが要るようになったら見直す。
- **Follow-up**: dry-run で書き込み・削除が呼ばれないことをテストする。

### Decision: 識別子は「開始の年月（日本標準時）－連番」にする

- **Context**: 識別子を機械的に決めたい。正規表現 `^[a-z0-9]+(-[a-z0-9]+)*$`、40 文字以内を満たす必要がある。
- **Alternatives Considered**:
  1. タイトルから生成（日本語は不可）
  2. 開始日時（`2026-11-05`）。同日の複数開始で衝突しうる
  3. 開始の年月＋連番（`2026-11-1`）
- **Selected Approach**: 3。同じ年月の既存の識別子と衝突しない最小の連番を使う。同じ内容の既存があればその識別子を再利用する。
- **Rationale**: 人が読める。再実行で増えない（同じ内容なら同じ識別子）。
- **Trade-offs**: 内容を直す再実行は、識別子を明示しないと別のアンケートとして追加され、期間の重複で検証に失敗する。スキルが状態の確認から識別子を特定して渡す。
- **Follow-up**: 同じ内容・同じ年月に別内容・識別子の明示の 3 通りをテストする。

### Decision: 除去の判定は「全 D1 で行なし」かつ「保持期限以後」。確認不能は除かない

- **Context**: 設定から先に消すとデータを自動で削除できなくなる。
- **Selected Approach**: 保持期限以後のアンケートにだけ問い合わせ、本番と develop の各 D1 の 2 表すべてで行が無いときだけ除く。問い合わせの失敗は「不明」として除かない。
- **Rationale**: 誤って除くと復旧に手作業が要る一方、除かない誤りは次のリリースで回収できる。
- **Trade-offs**: develop に行が残る限り設定に残る（develop の Cron の日次の削除で解消する）。
- **Follow-up**: 本番だけ 0 件、develop に行あり、問い合わせの失敗のそれぞれで除かれないことをテストする。

### Decision: 除去が書き換えた結果で 0 件になるときは変数を削除する

- **Context**: 空の配列が有効かは survey-definition の仕様に無い。
- **Selected Approach**: 0 件になるときは `gh variable delete`。未設定はレンダラーが「アンケートなし」として扱う（survey-definition 5.2）。
- **Rationale**: 上流の仕様に新しい解釈を足さない。

### Synthesis（design-synthesis の 3 観点）

- **Generalization**: 追加・除去・状態は「設定の元の読み出し→純粋な変換→正規化→書き込み」という同じ形の変種である。流れを 1 つ（`SurveyCli` の適用の関数）にし、変換だけを部品として切り出した。スキルが扱う聞き取りは設定の元に直接触れず、下書きのファイルを CLI に渡すだけにして、後から別の入口（別の言語の追加など）が増えても CLI の契約を変えない。初回時刻の割り当てと再利用も `SurveyConfigEditor` の同じ追加規則に含め、時刻の取得だけを CLI に置く。Claude と Codex のスキルは別々にネイティブ配置するが、同じ本文を維持し処理経路は共有 CLI に集約する。
- **Build vs Adopt**: 検証は survey-definition の `parseSurveyConfig` を、変数の読み書きは `gh`、回答データの確認は `wrangler d1 execute` を、リポジトリ判定と認証情報は `hack/sync-deploy-env.mjs` の `repositoryFromRemote`・`parseDeployEnv` を採用する。引数の解析は `node:util` の `parseArgs`（標準）で足りるため、CLI フレームワークは入れない。GitHub の REST クライアントを使う案は、認証の仕組みが `gh` と二重になるため採らない。作るのは、識別子の決定・正規化・容量の確認・除去の判定という、この機能に固有の規則だけ。
- **Simplification**: 要約の整形は CLI の関数に含め、独立した部品にしない。永続する状態（実行履歴・ロックファイル）は持たない。設定の元と D1 が真実で、毎回そこから判定する。dry-run は「書き込みの直前で止める」だけで、別の経路を持たない。初回時刻は変数に保存されるため、追加の登録台帳や更新履歴を新設しない。競合する書き込み（同時に 2 人が変更）への排他は、運営者が 1 人である前提で持たない。

## Risks & Mitigations

- `gh`・`wrangler` の出力形式や失敗の文言が変わる — 判定に使う箇所（変数が無い旨・D1 の JSON の形）を `SurveyRemote` に閉じ込め、固定の出力例でテストする。判別できない失敗は書き込みに進まない。
- 手元の認証が切れている — 認証が必要である旨を 1 行で示して異常終了する。マージの手順は続けられる（要件 6.3）。
- 翻訳・確認後に登録まで時間が経過すると、終了日時が登録時刻以前になる可能性がある — 上流の期間検証で拒否し、終了日時の修正と再確認を促す。
- 設定の元が 48KB に近づく — 状態の確認が使用量を示す。除去が定常的に容量を戻す。
- 運営者が除去の前にアンケートを設定から手で消す — 日次の削除が対象を失う。スキルは手で消さないことを手順に明記する（survey-api の運用の前提）。

## References

- [`gh variable` のマニュアル](https://cli.github.com/manual/gh_variable) — 変数の取得・設定・削除
- [`wrangler d1 execute`](https://developers.cloudflare.com/workers/wrangler/commands/#d1-execute) — リモートの D1 への問い合わせ
- [OpenAI の Claude Agent SDK 移行ガイド](https://developers.openai.com/cookbook/examples/agents_sdk/migrate-from-claude-agent-sdk/readme) — Claude skill と Codex repo-local skill の配置対応
- [OpenAI の Codex OSS ワークフロー解説](https://developers.openai.com/blog/skills-agents-sdk) — `.agents/skills/` と repo-local skills の使い方
- `hack/sync-deploy-env.mjs` — 標準入力で値を渡す流儀、`repositoryFromRemote`・`parseDeployEnv`
- `docs/features/survey-definition/design.md`・`docs/features/survey-api/design.md` — 上流の契約
