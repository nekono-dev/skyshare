// テスト用の固定の識別子と鍵。実在のアカウントや本番の鍵は含めない。
// DID とハンドルは、テストの中だけで意味を持つ架空の値とする。

/** テスト用の DID（架空。実在のアカウントではない） */
export const TEST_DID = "did:plc:testfixturealice0000000000"

/** テスト用のハンドル（架空） */
export const TEST_HANDLE = "alice.test"

/** テスト用の 32 バイトの鍵（Base64。0〜31 のバイト列。実際の秘密ではない） */
export const TEST_KEY_BASE64 = btoa(
    String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i)),
)
