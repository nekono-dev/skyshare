---
name: spec-driven-development
description: 機能の新規追加・修正に着手する前に、specs/<component>/ 配下へ requirements.md・design.md・tasks.md の3点セットを雛形どおりに整備し、検証スクリプトで機械的に合否判定する仕様駆動開発の原則。「要件定義」「設計書」「タスク一覧」「仕様書」「アーキテクチャ」「architecture.md」「全体構成」「PoC」という言葉が出たとき、既存の仕様ドキュメントに「TODO」「検討中」「未定」「未決事項」「未実装」「実装状況」のような進捗管理的な記述が混ざっているとき、または機能追加・修正の作業に着手する前に使う。中〜大規模（設計済み spec が3件以上）では、全体構造を示す docs/architecture.md と、技術検証の poc/<テーマ>/README.md も同じ検証スクリプトで管理する。
---

# 仕様駆動開発（Spec-Driven Development）

機能の追加・修正を行う際は、`specs/<component>/` に次の3ファイルを整備することを必須の前提とする。仕様書の合否は **`npm run lint:spec` の結果のみ** で判定し、レビュー担当（人間か AI か）によって基準を変えない。

| ファイル          | 役割                             | 更新契機                         |
| ----------------- | -------------------------------- | -------------------------------- |
| `requirements.md` | 何を実現すべきか（要件）         | 仕様変更時のみ                   |
| `design.md`       | それをどう実現するか（設計）     | 設計変更時のみ                   |
| `tasks.md`        | 具体的に何をするか（作業と検証） | 作業のたびに（チェックボックス） |

依存は一方向: `tasks.md` → `design.md` → `requirements.md`。実装や作業の都合で要件・設計を歪めない。

中〜大規模の開発（設計済みの spec が設定の閾値以上。初期 3 件）では、spec に加えて、システム全体の構造を人間が読める形で示す **`docs/architecture.md`** を必須とする。architecture.md は spec と PoC を根拠にした下流の文書で、`npm run lint:spec` が spec との突合・体裁・語彙・図を検査する。内部の構成要素が設定の閾値以上（初期 8 個）になったら、構成要素を **機能のくくり** にまとめ、全体の `docs/architecture.md` と、くくりごとの `docs/architecture/<くくり>.md`（全体と同じ 9 章構成）に分ける。くくりは「利用者から見て 1 つの目的で説明できる機能のまとまり」（例: 通知の発行、通知の保管、通知の表示）で、構成要素ごと・振る舞いごとに文書を作らない。新規開発では PoC（`poc/<テーマ>/README.md`）で技術リスクを検証してから spec と architecture.md を確定する。手順と判断基準は `references/workflow.md`、雛形は `templates/architecture.md`（1 ファイル）・`templates/architecture-grouped/`（全体 + くくり）・`templates/poc-readme.md`。

仕様駆動開発の目的は、開発の整合性を保ち、何をなぜ作ったかを明白（ホワイトボックス）にすることである。仕様にない作業を禁止する仕組みではない。突発的なバグ修正等で spec を経ずにコードを変更してよいが、その変更が既存 spec の要件・設計と食い違う場合は、同じ変更の中で該当 spec を更新する。

## 構成

```
.claude/skills/spec-driven-development/
├── templates/          # 雛形（記入例。そのままチェックを通過する）。spec の3点セット・architecture.md・architecture-grouped/（全体 + くくり3件）・poc-readme.md・spec-driven.json
├── references/
│   ├── rules.md        # 全ルールの一覧（スクリプトから生成。手で編集しない）
│   └── workflow.md     # architecture（1 ファイルとくくり別）と PoC の手順・判断基準・目視確認・設定
└── scripts/
    ├── check-all.mjs        # 一括実行（npm run lint:spec）
    ├── check-structure.mjs  # S系: ディレクトリ構成・spec 間の独立性・architecture と spec／PoC／くくりの文書の突合
    ├── check-format.mjs     # F系: 雛形どおりの体裁・ID・トレーサビリティ・サイズ上限
    ├── check-diagram.mjs    # G系: 関係図・ワークフロー図（mermaid）の構造と、構成表・設計項目との対応
    ├── check-wording.mjs    # W系: 規定にそぐわない語・表現（spec・architecture・PoC）
    ├── check-architecture.mjs # F-A系: docs/architecture.md とくくりの文書の章立て・表と図の対応・機能の関与・くくり間の依存
    ├── check-poc.mjs        # F-P系: poc/<テーマ>/README.md の体裁と結論・結果の整合
    ├── docs-model.mjs       # architecture・PoC の文書モデル（各チェックと --status が共有）
    ├── commands.mjs         # --status／--retarget-poc／--check-poc-committed／--show-config
    ├── mermaid-syntax.mjs   # 図の構文検証（G014）。依存の導入状態の確認と mermaid.parse の呼び出し
    ├── package.json         # 依存（mermaid・jsdom）の完全固定。git 管理する
    ├── package-lock.json    # 同上のロックファイル。git 管理する
    ├── node_modules/        # 依存の導入先（git 管理しない。scripts/.gitignore で除外）
    ├── selftest.mjs         # スクリプト自身のテスト（npm run test:spec）。selftest-docs.mjs・selftest-lib.mjs を読み込む
    ├── selftest-docs.mjs    # architecture・PoC・設定・補助コマンドのテスト
    └── selftest-lib.mjs     # テストの共通部
```

## 開始時のスキル更新

このスキルを使い始めるとき（spec・architecture・PoC の作業に着手する前）に、最初に 1 回だけ、スキル自身を最新にする。スキルのディレクトリは、この SKILL.md があるディレクトリ（symlink は `realpath` で実体を辿る）。

1. スキルのディレクトリが git の作業ツリーの最上位か確認する: `git -C <スキルのディレクトリ> rev-parse --show-toplevel` が、そのディレクトリ自身を返す。
2. 返すなら `git -C <スキルのディレクトリ> pull --ff-only` を実行する。
3. 取り込みがあった（"Already up to date." 以外）ときは、更新後の `SKILL.md` を読み直し、`scripts/package.json` か `scripts/package-lock.json` が変わっていれば `scripts/` で `npm ci --ignore-scripts` を実行する。
4. 失敗した（未コミットの変更、履歴の分岐、ネットワーク不通）ときは、強制せず（`reset`・`stash`・`--force` を使わない）、失敗の理由を 1 行で利用者に伝えて、現在の版のまま作業を続ける。
5. git の作業ツリーでない（プロジェクトへの単なるコピー）ときは、更新できないことを 1 行で利用者に伝え、`git clone git@github.com.nekono:nekono-dev/spec-driven-development.git ~/.claude/skills/spec-driven-development` での導入を勧めて、そのまま作業を続ける。

同じ会話の中では繰り返さない。利用者が更新しないよう指示したときは行わない。

## 手順

1. 対象コンポーネントの `specs/<component>/` が存在するか確認する。なければ `templates/` の3ファイルをコピーして作成する。要件は確定しているが設計・実装に着手しない機能は、`requirements.md` だけを置く（「要件のみ」。設計に着手するとき design.md と tasks.md を両方追加する）。
2. 雛形の記入例を対象の内容に置き換える。見出し・行形式は変えない。
3. `npm run lint:spec -- <component>` を実行し、指摘が0件になるまで本文を修正する。指摘の意味は `references/rules.md` を参照する。合格後に「図の目視確認」（後述）を1回実施する。
4. spec の追加・削除や構成要素・技術基盤・制約値の変更を伴うとき、設計済み spec が閾値以上なら、同じ変更の中で `docs/architecture.md` を更新する（`references/workflow.md`）。
5. 判断が必要な事項（要件・設計の未確定点）は、作成中に意思決定者（人間）へ確認し、結論を本文に反映してから完了とする。未確定のまま残す書き方はスクリプトが弾く（W001）。

`lint:spec` は `prettier --check specs` による整形確認の後にチェックスクリプトを実行する。整形の指摘は `npx prettier --write specs` で解消する。同じ入力に対して常に同じ出力を返す。`--json` で機械可読な出力、`--root <dir>` で specs ルートの変更ができる。対象には spec 名のほか `architecture`、`poc/<テーマ>` を指定できる（省略時は全件）。終了コードは 0=指摘なし／1=指摘あり・依存の未導入／2=引数エラー・設定エラー。

補助コマンド（lint の合否には使わない）:

| コマンド                                                 | 内容                                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm run lint:spec -- --status`                          | spec・PoC・architecture の工程を成果物から導出して表示する（宣言値は持たない。常に終了コード 0） |
| `npm run lint:spec -- --retarget-poc <テーマ> [--write]` | architecture の根拠 `poc/<テーマ>` を、PoC の反映先 spec へ付け替える（既定は差分の表示のみ）    |
| `npm run lint:spec -- --check-poc-committed <テーマ>`    | PoC の削除前確認（read-only。0=削除可／1=未コミットあり／2=追跡外）。CI には含めない             |
| `npm run lint:spec -- --show-config`                     | 実効値の設定（`.spec-driven.json`）を表示する                                                    |

閾値などの数値は、リポジトリ直下の `.spec-driven.json` で調整できる（数値のみ。範囲外はエラー。`references/workflow.md` の 9 節）。

### 依存の導入

図の構文検証（G014）だけが外部パッケージ（mermaid・jsdom）を使う。依存は `scripts/` に閉じ込めてあり、プロジェクトのルートの `package.json`・`node_modules` には触れない。Node 22.12 以上が必要。

- 導入: プロジェクトのルートで `npm ci --ignore-scripts --prefix .claude/skills/spec-driven-development/scripts` を実行する（CI でも `lint:spec` の前に同じコマンドを置く）。
- 未導入・版違いのとき: `lint:spec` は導入コマンドを表示して終了コード 1 で止まる。検証を黙って省かない。ただし図のない spec（構成表3行以下で「- なし」）だけを検査するときは依存を読み込まない。
- `package.json` の版は完全固定する（`^` `~` を付けない）。版を変えるときは `npm install --ignore-scripts --prefix <scripts のパス>` で lockfile を更新し、`npm run test:spec` を通す。
- `--no-syntax` は G014 を省く。selftest 専用で、`lint:spec` や CI では使わない。

## ディレクトリ規則（S系）

- **1ディレクトリ = 1コンポーネント**。実装上のまとまり（例: `notification-api`、`delivery-worker`）ごとに `specs/` 直下へ作る。1コンポーネントに複数の FR を含めてよいが、FR が複数コンポーネントにまたがる場合はコンポーネントごとに分割する。
- **階層を作らない**。`specs/<component>/` の下にサブディレクトリや3ファイル以外を置かない。`requirements.md` は必須で、`design.md` と `tasks.md` は両方置くか両方置かない（両方なしは「要件のみ」の spec）。
- **他 spec と関係を持たせない**。他 spec への言及は `requirements.md` の「3. 前提」に `- 前提: <spec名> — <理由>` の形式でのみ書ける（2件以内）。前提先の spec 自身は前提を持てない（連鎖・循環の禁止）。design.md・tasks.md からは他 spec に一切言及しない。
- 全タスクが完了（`[x]`）した spec は、次を満たさなければならない（仕様と実装の乖離検出）。
  - design.md の構成表のパス、tasks.md の検証行・E2E 行のテストファイルが実在する。
  - すべての受け入れ条件 `AC-n` について、`tests/` 配下にテスト名へ `<spec名>/AC-n` を含むテストが存在する（例: `test("notification-badge/AC-1: 未読3件で「3」を表示する", …)`）。
  - 構成表のパスがすべて存在しない spec は、実装が除去された dead spec とみなし、spec ディレクトリごと削除する（S009）。

## ID とトレーサビリティ

```
FR-n / NFR-n ──(受け入れ条件)── AC-n (FR-m)
      │
      └──(設計項目の見出しタグ)── ### D-n: <題> (FR-m, NFR-k)
                                        │
                                        └──(Phase の対応行)── - 対応: D-n   ※各 D はちょうど1つの Phase
                                                                └── - [ ] T-p.m: <作業>
```

- ID はファイル内で1からの連番とし、欠番を作らない。
- 対応関係は上図の位置（AC の括弧・D 見出しのタグ・Phase の対応行）でのみ表す。本文中で ID や他の仕様書ファイル名に言及しない。参照の網を作らないことで、各文書を上から順に一度読めば理解できる状態を保つ。

## 各ファイルの原則

### requirements.md

- 「現状の実装がどうなっているか」に依存しない書き方をする。新機能と既存機能の改修で文体・粒度を変えない。
- 実装の詳細（ファイルパス・関数名・バッククォート）を書かない。受け入れ条件からの `tests/` パス参照のみ許可する。
- FR／NFR／AC は1行1文で書く。NFR は数値を含めて定量的に書く。

### design.md

- 方針が確定していることを前提とした文書であり、実装状況の整理表・先送りの記述を書かない。判断を実装時の裁量に委ねると決めたなら、「委ねる」という方針自体を書く。
- 各設計項目（D）は、関数シグネチャ・データ構造・疑似コード・シーケンスのいずれかをコードブロックまたは表で示し、ソースコードの水準まで具体化する。
- 「2. 関係図・ワークフロー」に、構成要素の依存を示す**関係図**と、処理の流れ・状態遷移を示す**ワークフロー図**を mermaid で書く（次節）。構成表が3行以下の spec のみ「- なし」で免除できる。

### tasks.md

- 実装状況の追跡はチェックボックスに一本化する。新たな仕様判断・設計判断をここで行わない。疑問が生じたら requirements／design に立ち返って更新する。
- Phase は実行順に5個以内とし、細分化しない。各 Phase は「対応 → タスク → 検証 →（E2E）」の固定形とする。

## 図（関係図・ワークフロー）

構成表が4行以上の design.md は、「2. 関係図・ワークフロー」に次を置く。構成は「説明1行（80文字以内の1文）→ mermaid ブロック」の繰り返しのみで、関係図とワークフロー図を各1〜2個書く。

| 区分           | 図種                                 | 示すもの                                     |
| -------------- | ------------------------------------ | -------------------------------------------- |
| 関係図         | `flowchart`、`classDiagram`          | 構成要素と依存方向（A → B は A が B に依存） |
| ワークフロー図 | `sequenceDiagram`、`stateDiagram-v2` | 呼び出し順・失敗時の分岐・状態遷移           |

- 記法は G005 の部分集合に限る。1図はノード3〜20個とし、ノード名とエッジ名は30文字以内（状態名・遷移ラベルは15文字以内）とする。
- ノード名は構成表のパスのベース名（拡張子なし。同名が複数あれば `親ディレクトリ/名`）と一致させる。構成表にない外部要素は、ノード ID を `ext_` で始める（例: `ext_agent["Agent"]`）。
- 構成表の全行を関係図に載せる。設計項目のコードブロックで `export` した関数・クラス・定数の名前は、いずれかの図のラベル（メッセージ名など）に載せる。
- ワークフロー図には分岐（`alt`／`opt`／`break`、または2本以上の遷移が出る状態）を含める。
- 状態図の状態 ID は ASCII の PascalCase とし、`[*] --> S` の開始遷移を1本置き、すべての状態から出る遷移を書く（終了は `--> [*]`）。
- 図の中の語にも表現チェック（W 系）が掛かる。状態名に「完了済」「対応済」「予定」は使えない（「完了」「対応」と書く）。

### 図の目視確認（Claude が実施する）

`lint:spec` が合格した後、次の5項目を上から順に1回ずつ数える。判定は「該当数が0」か否かのみで行い、好みの指摘は加えない。該当が0件なら図を変更しない（同じ入力には同じ結論になる）。

1. 関係図のエッジのうち、設計項目の関数・型の記述（呼び出し・引数・戻り値）に根拠がないものの数。
2. ワークフロー図のメッセージ名・遷移のうち、設計項目の関数・状態の定義と食い違うものの数。外部要素との間のメッセージは数えない。
3. 設計項目のコード・表にある状態の定義（型の列挙値など）のうち、状態図にない状態の数。逆に、状態図にあって設計項目にない状態の数。
4. 設計項目の表・疑似コードのうち、図と同じ呼び出し順・遷移を再記述しているものの数。
5. 1つのノード・状態の名前に、同じ要素を指す別名が併存している組の数。

## UI 実装の検証（ヘッドレスブラウザ必須）

UI に関わる Phase（`.tsx`／`.astro`／`.css`／コンポーネント／画面／ページ／UI を含むもの）は、`tsc`／`vitest` 等に加えて **Playwright によるヘッドレスブラウザでの実動作確認を完了条件に含める**。

- ``- E2E: `tests/e2e/<名>.spec.ts` <操作> → <期待結果>`` 行に、Playwright のテストファイルと操作手順・期待結果を明記する（F-T06・S007 で機械検証する）。
- 実ブラウザで操作（クリック・入力・タブ切り替え等）した後の DOM／表示内容を検証する。`curl` での SSR 出力確認や `--dump-dom` の静的スナップショットだけでは不十分である（インタラクション後の状態を検証できないため）。
- テスト資産は `tests/e2e/` 配下に恒久的に残し、リグレッション防止に再利用する。
- ログイン等の外部要因で自動化できない確認がある場合は、E2E 行に手動確認の手順を書いた上で、自動化可能な範囲は Playwright で確認する。

## スクリプトで判定できない観点

次の観点は機械判定できないため、仕様書の作成・更新時に必ず目視で確認する。

- 要件が目的を過不足なく満たしているか。対象外に書いた事項が FR に混入していないか。
- 設計項目が要件を実際に実現できる内容か（タグが付いているだけでないか）。
- タスクの順序で実装した場合に、各 Phase の検証が単独で成功するか。
- 図が設計項目と矛盾していないか（「図の目視確認」の5項目で確認する）。

## ルールの変更

ルールを変更するときは、次をすべて同じ変更で行う。

1. `scripts/check-*.mjs` の `rules` 定義と判定処理を変更する。
2. `scripts/selftest.mjs`（spec 用）または `scripts/selftest-docs.mjs`（architecture・PoC 用）に、そのルールが発火するケースを追加する（全ルール ID のケース網羅はテストで強制される）。
3. `node scripts/check-all.mjs --rules > references/rules.md` で一覧を再生成する。
4. 雛形を変えた場合も含め、依存を導入した状態で `npm run test:spec` が成功することを確認する。
