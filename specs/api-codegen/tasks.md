# APIスキーマとクライアントの生成 タスク一覧

## Phase 1: ドキュメントの組み立て

- 対応: D-1
- [x] T-1.1: `index.ts` と `build-openapi-document.ts` を実装する。
- [x] T-1.2: ドキュメントの単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/api/schema/openapiDocument.test.ts`

## Phase 2: クライアントの取得処理とフォームデータ

- 対応: D-2
- [x] T-2.1: `fetcher.ts` と `openapiFormData.ts` を実装する。
- [x] T-2.2: 取得処理とフォームデータの単体テストを受け入れ条件のタグ付きで追加する。
- [x] T-2.3: Blob で返す判定を応答の content-type に改め、予約の画像の取得を AC-6 のテストに加える。
- 検証: `npx vitest run tests/lib/codegen/fetcher.test.ts tests/lib/codegen/openapiFormData.test.ts`

## Phase 3: サーバー側の復元と補助

- 対応: D-3
- [x] T-3.1: `formData.ts` と `http.ts` を実装する。
- [x] T-3.2: 復元と補助の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/util/formData.test.ts tests/util/http.test.ts`
