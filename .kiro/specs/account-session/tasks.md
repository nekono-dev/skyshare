# Implementation Plan

- [x] 1. cookie とプール
- [x] 1.1 `cookies.ts` に符号化・復号・プール操作を実装する。
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.3, 8.1_
- [x] 1.2 cookie とプールの単体テストを受け入れ条件のタグ付きで追加する。
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.3, 8.1_
- [x] 1.3 セッションの種類つきの形と、枠ごとのプールの cookie と `admitSession` に改め、受け入れ条件 1.2 のテストをタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/session/cookies.test.ts`
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.3, 8.1_

- [x] 2. セッション操作のAPI
- [x] 2.1 一覧・追加ログイン・切り替え・ログアウトのハンドラを実装する。
  - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.2, 5.1, 5.2_
- [x] 2.2 各ハンドラの単体テストを受け入れ条件のタグ付きで追加する。
  - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.2, 5.1, 5.2_
- [x] 2.3 各ハンドラをセッションの種類によらない形に改め、既存のテストを新しい形に合わせる。
  - 検証: `npx vitest run tests/pages/v2/bsky/session.test.ts "tests/pages/v2/bsky/session/[did].test.ts"`
  - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.2, 5.1, 5.2_

- [x] 3. 自動再開とクライアントの取得
- [x] 3.1 `bskySessionRefresh.ts` と `activeAccountSession.ts` を実装する。
  - _Requirements: 6.1, 6.2, 6.3, 7.1, 7.2_
- [x] 3.2 自動再開と共有取得の単体テストを受け入れ条件のタグ付きで追加する。
  - _Requirements: 6.1, 6.2, 6.3, 7.1, 7.2_
- [x] 3.3 自動再開で OAuth のセッションを委ねる形にし、`global.d.ts` の型を改める。
  - 検証: `npx vitest run tests/lib/session/bskySessionRefresh.test.ts tests/lib/account/activeAccountSession.test.ts`
  - _Requirements: 6.1, 6.2, 6.3, 7.1, 7.2_
