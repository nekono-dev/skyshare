# Implementation Plan

- [x] 1. ドキュメントの組み立て
- [x] 1.1 `index.ts` と `build-openapi-document.ts` を実装する。
  - _Requirements: 1.1, 1.2_
- [x] 1.2 ドキュメントの単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/api/schema/openapiDocument.test.ts`
  - _Requirements: 1.1, 1.2_

- [x] 2. クライアントの取得処理とフォームデータ
- [x] 2.1 `fetcher.ts` と `openapiFormData.ts` を実装する。
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3_
- [x] 2.2 取得処理とフォームデータの単体テストを受け入れ条件のタグ付きで追加する。
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3_
- [x] 2.3 Blob で返す判定を応答の content-type に改め、予約の画像の取得を 2.4 のテストに加える。
  - 検証: `npx vitest run tests/lib/codegen/fetcher.test.ts tests/lib/codegen/openapiFormData.test.ts`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3_

- [x] 3. サーバー側の復元と補助
- [x] 3.1 `formData.ts` と `http.ts` を実装する。
  - _Requirements: 3.4, 3.5, 4.1, 4.2, 4.3, 4.4_
- [x] 3.2 復元と補助の単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/util/formData.test.ts tests/util/http.test.ts`
  - _Requirements: 3.4, 3.5, 4.1, 4.2, 4.3, 4.4_
