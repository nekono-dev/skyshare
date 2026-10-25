# アカウントセッション管理 タスク一覧

## Phase 1: cookie とプール

- 対応: D-1
- [x] T-1.1: `cookies.ts` に符号化・復号・プール操作を実装する。
- [x] T-1.2: cookie とプールの単体テストを受け入れ条件のタグ付きで追加する。
- [x] T-1.3: セッションの種類つきの形と、枠ごとのプールの cookie と `admitSession` に改め、受け入れ条件 AC-18 のテストをタグ付きで追加する。
- 検証: `npx vitest run tests/lib/session/cookies.test.ts`

## Phase 2: セッション操作のAPI

- 対応: D-2
- [x] T-2.1: 一覧・追加ログイン・切り替え・ログアウトのハンドラを実装する。
- [x] T-2.2: 各ハンドラの単体テストを受け入れ条件のタグ付きで追加する。
- [x] T-2.3: 各ハンドラをセッションの種類によらない形に改め、既存のテストを新しい形に合わせる。
- 検証: `npx vitest run tests/pages/v2/bsky/session.test.ts "tests/pages/v2/bsky/session/[did].test.ts"`

## Phase 3: 自動再開とクライアントの取得

- 対応: D-3, D-4
- [x] T-3.1: `bskySessionRefresh.ts` と `activeAccountSession.ts` を実装する。
- [x] T-3.2: 自動再開と共有取得の単体テストを受け入れ条件のタグ付きで追加する。
- [x] T-3.3: 自動再開で OAuth のセッションを委ねる形にし、`global.d.ts` の型を改める。
- 検証: `npx vitest run tests/lib/session/bskySessionRefresh.test.ts tests/lib/account/activeAccountSession.test.ts`
