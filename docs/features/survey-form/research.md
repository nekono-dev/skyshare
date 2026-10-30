# Research & Design Decisions

## Summary

- **Feature**: `survey-form`
- **Discovery Scope**: Extension（既存のアカウント確定・ダイアログ・多言語の仕組みへ、起動時の判定と画面を足す。外部の新規依存なし）
- **Key Findings**:
  - アクティブなアカウントの確定は 1 か所に集約されている（`getSessionOnce` の共有キャッシュ）。ログイン成功とアカウント切り替えはどちらも `window.location.href = "/"` の全体遷移で終わるため、「ログイン直後」「ログイン情報のある起動」「アカウントの追加・切り替え」はすべてページの初回読み込みとして現れる。
  - `Baselayout.astro` には既に全ページ共通のアイランド（`AuthorizationReturn`）がある。同じ場所に置けば、プライバシーポリシーを含む全ページで 1 回だけ動かせる。ページ別の除外は判定の側で行う。
  - 既存の `Overlay` は背景の押下と Esc で `onClose` を呼ぶ。必須のダイアログは `onClose` を何もしない関数にするだけで閉じさせない。`ChoiceDialog` は選択肢ボタンだけで質問を載せられないため、`Overlay` を直接使う（`ConfirmDialog` と同じ流儀）。
  - E2E は `hack/run-e2e.mjs` が dev サーバーを起動して `playwright test` を流す。配信用の設定の有無はビルド（dev 起動）の時点で旗になるため、設定の生成は dev サーバーの起動より前でなければならない。
  - Playwright の既定のフィクスチャ（`tests/e2e/fixtures.ts`）は全 spec が共有する。設定を有効にすると、ログイン済みをモックした既存 spec でも回答済みの確認が走り、未モックだと実サーバーの 401 がコンソールにエラーとして出る。

## Research Log

### アクティブなアカウントの確定点

- **Context**: 「アクティブなアカウントが確定したとき」にどこで判定を挟むか。
- **Sources Consulted**: `src/lib/account/activeAccountSession.ts`、`src/components/account/AccountSwitcher/index.tsx`、`src/components/account/LoginForm/index.tsx`、`src/components/layout/nav/syncAccountAvatar.ts`。
- **Findings**:
  - セッションの取得は `getSessionOnce`（進行中の取得を 1 本にまとめる）と `getActiveAccountInfo`（did とアイコン）に集約されている。未ログインは 401 を sessionStorage に記録し、以降は通信しない。
  - ログイン成功・アカウント切り替えは全体遷移（`window.location.href = "/"`）。ページ遷移（`astro:page-load`）のたびにキャッシュが破棄される。
- **Implications**: 判定は `getActiveAccountInfo` から did を得れば足りる。ログイン直後と切り替え直後は全体遷移で初回読み込みになるため、専用のイベントは要らない。未ログインでは追加の通信が起きない（`getActiveAccountInfo` が合成の 401 を返す）。

### 共通アイランドの置き場所と View Transitions

- **Context**: ページ遷移（ClientRouter）のたびに判定が再実行され、サーバーアクセスが増えないか。
- **Sources Consulted**: `src/layout/Baselayout.astro`、`src/components/layout/Sidebar/index.astro`（`transition:persist` の前例）。
- **Findings**: アイランドは遷移のたびに新しいページの HTML で差し替わる。`transition:persist` を付けると同じインスタンスが保たれる。
- **Implications**: 共通アイランドに `transition:persist` を付け、同じ文書の間は 1 回だけ判定する。プライバシーポリシーのページでは判定を見送り、他のページへ移動したときに（`astro:page-load`）改めて判定する。ダイアログが開いている間に遷移で消えることも防げる。

### 既存のダイアログと選択部品

- **Context**: ダイアログの骨格と質問の描画。
- **Sources Consulted**: `src/components/common/Overlay`、`ChoiceDialog`、`ConfirmDialog`、`docs/features/choice-question/design.md`、`src/styles/dialog.ui.module.css`。
- **Findings**: `Overlay` は `open`・`onClose`・`contentClassName` を受ける。`ChoiceQuestion` は `kind`・`legend`・`choices`・`selectedIds`・`onChange`・`maxSelect`・`disabled` を受け、選択状態を保持せず補正もしない。上限の判定は選択中の数が `maxSelect` 以上で未選択のものを無効にする。
- **Implications**: 「回答しない」の排他と上限の扱いは survey-form が選択状態の補正として持つ（部品はアンケートの知識を持たない）。「回答しない」が選ばれている間は、上限による無効化が他の選択肢への切り替えを妨げないよう、`maxSelect` を渡さない。

### 端末の記録の形

- **Context**: ロードマップで確定している記録の形の扱い方。
- **Findings**: キー `skyshare.survey.<surveyId>` に `{ answered, dids }`。破損・保存不可は「記録なし」に倒す。タブごとの辞退は sessionStorage の別のキーに持つ。アカウント識別子は端末に残るが、回答の内容は残さない。
- **Implications**: 記録の読み書きは例外を外へ出さない 1 つのモジュールにまとめる。

### 検証用の設定の供給

- **Context**: survey-definition の Out of Boundary により、E2E のハーネスは survey-form が持つ。
- **Sources Consulted**: `hack/run-e2e.mjs`、`playwright.config.ts`、`tests/e2e/fixtures.ts`、`docs/features/survey-definition/design.md`（SurveyConfigRenderer は任意の入力を受け取れる）。
- **Findings**: 旗は dev サーバーの起動時の生成物の有無で決まる。dev サーバーが既に起動していると、後から生成しても旗は変わらない。`run-e2e.mjs` は起動済みの dev を再利用し、停止もしない。
- **Implications**: 生成は dev サーバーの起動の前に、`run-e2e.mjs` が自分で起動する場合にだけ行う。終了後は、元の環境変数で生成し直して通常の状態に戻す。起動済みの場合は、spec が配信用の設定の有無を実行前に確かめ、無ければ理由を示して実行を見送る。

## Architecture Pattern Evaluation

| Option                                 | Description                                                         | Strengths                             | Risks / Limitations                                       | Notes                             |
| -------------------------------------- | ------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------- | --------------------------------- |
| 共通アイランドが判定と表示を持つ       | `Baselayout` に常駐するアイランドが、判定・ダイアログ・送信を束ねる | 全ページで 1 回。除外はページ側の条件 | 遷移で再生成されないよう `transition:persist` が要る      | 採用                              |
| ページごとのアイランドに判定を組み込む | Timeline など各ページの確定点で判定を呼ぶ                           | 既存のページ側のコードで把握しやすい  | ページの追加のたびに漏れる。判定が分散する                | 不採用                            |
| サーバー（SSR）で表示の要否を決める    | セッションのある応答に要否を埋め込む                                | 追加の通信が不要                      | D1 に触れる経路が通常のページに混ざる。静的ページに不向き | 不採用（無料枠の CPU を守れない） |

## Design Decisions

### Decision: 判定の順序は「ページ → 設定 → 辞退 → アカウント → 端末の記録 → サーバー」

- **Context**: 通常の利用で通信を増やさず、辞退したタブでは通信を完全に止める。
- **Alternatives Considered**:
  1. アカウントを先に取得してから他を判定する。
  2. 通信の要らない順（ページの除外、設定の有無、タブの辞退）を先にする。
- **Selected Approach**: 2。除外ページとゲスト表示は通信なしで見送り、設定が無ければ（旗が偽なら）通信せず終える。辞退済みのタブは、アカウントの取得より前に見送る。
- **Rationale**: 要件 1.3・1.4・5.7（通信しない）を最も安く満たす。
- **Trade-offs**: 辞退の判定がアカウントに依存しない（同じタブでは別のアカウントでも再表示しない）。要件 5.5 の「同じタブの間は同じアンケートを再表示しない」と一致する。
- **Follow-up**: なし。

### Decision: 回答しないの排他は選択状態の補正として持ち、共通部品には持ち込まない

- **Context**: 「回答しない」は他の選択肢と同時に選ぶ意味がない。共通部品はアンケートの知識を持たない。
- **Selected Approach**: 部品の `onChange` で受けた次の選択を、`SurveyAnswerDraft` が補正する（「回答しない」が新たに選ばれたらそれだけにする。他が選ばれたら「回答しない」を外す）。
- **Rationale**: 部品の再利用性を保ち、補正の規則を純粋関数として単体で検証できる。

### Decision: ダイアログは `Overlay` を直接使い、閉じる操作を持たせない

- **Context**: 必須だが、「回答しない」を選べば閉じられる。
- **Selected Approach**: `onClose` は何もしない。送信の操作は、「回答しない」が選ばれている間だけ「閉じる」の操作になり、送らずに閉じる。
- **Rationale**: 利用者が閉じられる唯一の経路を「回答しない」に限り、要件 3.5 と 5.3 を満たす。

### Decision: 検証用の設定は固定の資材 1 つと、生成の呼び出し側（run-e2e）で供給する

- **Context**: 生成の仕組みは survey-definition が持ち、任意の入力を受け取れる。
- **Selected Approach**: 検証用の設定を `tests/fixtures/survey/e2e-open.json` として置き、`run-e2e.mjs` が dev サーバーの起動前に環境変数 `SURVEY_CONFIG` に与えて生成する。終了後は元の環境変数で生成し直す。
- **Rationale**: 生成・検証の実装を重複させず、設定の検証を通ることを単体テストで保証できる。
- **Follow-up**: 起動済みの dev サーバーを再利用する場合は旗が変わらないため、spec が事前に確かめて見送る。

### Decision: 既定のフィクスチャで回答済みの確認を既定応答にする

- **Context**: 設定が有効な E2E では、ログイン済みをモックする既存 spec でも回答済みの確認が実サーバーへ飛び、401 がコンソールのエラーになる。
- **Selected Approach**: `tests/e2e/fixtures.ts` の `page` に、回答済みの確認への既定応答（回答済み）を登録する。アンケートの spec は後から登録して上書きする。
- **Rationale**: 要件 7.6（既存の画面の確認に影響しない）を、既存 spec を 1 つずつ直さずに満たす。

## Design Synthesis

### Generalization

- 「端末の記録を見て、サーバーに聞く」は、アンケートの識別子と did を引数に取る関数にまとめる。`decideLaunch` はアンケートの内容を知らないため、複数のアンケートに適用できる。ただし現時点の要件は「開催中の 1 件」であり、複数同時の開催には広げない（期間の重複は survey-definition が禁じている）。

### Build vs Adopt

- 状態管理・フォーム・ダイアログ・多言語・選択部品はすべて既存を使う（`Overlay`、`ChoiceQuestion`、`useT`、`getActiveAccountInfo`、生成済みの API クライアント）。新しい依存は足さない。端末の記録は Web Storage の直接利用が最小で、ライブラリを足す理由がない。

### Simplification

- 判定の状態機械を持たず、`decideLaunch` を「記録 → 登録 or 確認 → 結果」の直線の関数にする。送信の結果は 5 つの分類に正規化し、画面は分類だけを見る。
- ダイアログの外側の状態（`pending`・`busy`・`failed`）は `SurveyGate` の 3 つの値だけにする。
- ページ除外は専用の部品にせず、判定の入口の関数として `SurveyLaunchCheck` に同居させる。

## Risks & Mitigations

- 共通アイランドを `transition:persist` にすると、水和や再描画の挙動が変わる可能性がある — E2E でクライアント遷移（プライバシーポリシー → 他のページ）を確認する。
- 起動済みの dev サーバーでは検証用の設定が反映されない — 実行前に配信用の設定の有無を確かめ、無ければ理由を示して見送る。
- 生成された API クライアントの関数名が survey-api の実装で確定する — クライアントの薄い包み（`SurveyApiClient`）に閉じ込め、画面は分類だけを見る。
- 複数選択で上限と「回答しない」の排他が干渉する — 「回答しない」の選択中は上限を渡さず、補正で排他にする。単体テストで境界（上限ちょうど・回答しないからの切り替え）を確認する。
- 端末の記録に did が残る — 保存するのは回答済みの旗と did だけで、回答の内容や時刻は保存しない（要件 2.10）。

## References

- `docs/features/survey-definition/design.md` — 設定の形式・`currentSurvey`・`fetchSurveyConfig`・生成処理。
- `docs/features/survey-api/design.md` — 3 つの操作の契約と状態コード。
- `docs/features/choice-question/design.md` — `ChoiceQuestion` の契約。
- `DEVELOP.md` — UI 実装の検証（Playwright）。
