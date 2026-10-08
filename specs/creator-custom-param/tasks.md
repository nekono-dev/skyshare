# クリエイターモードのカスタムパラメータ タスク一覧

## Phase 1: 検証と変換

- 対応: D-1
- [ ] T-1.1: `customFields.ts` を実装し、単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/postFeatures/customFields.test.ts`

## Phase 2: APIの受け付け

- 対応: D-3
- [ ] T-2.1: 投稿のスキーマに `customFields` を加え、ハンドラで検証と統合を行う。
- [ ] T-2.2: 投稿APIの仕様書に、受け付けるフィールドとして `customFields` を追記する。
- 検証: `npx vitest run tests/pages/v2/entry.test.ts`

## Phase 3: パネルと送信

- 対応: D-2
- [ ] T-3.1: `CustomFieldsPanel` を実装し、ツールの一覧に登録して送信に組み込む。
- 検証: `npm run build`
- E2E: `tests/e2e/creatorCustomParam.spec.ts` パネルで「promo.code」を入力して投稿する → 送信内容に入れ子の promo.code が含まれ、説明文が表示されている
