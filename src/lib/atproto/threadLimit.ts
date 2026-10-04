/**
 * スレッド投稿数の上限。`v2/entry`の`posts`配列・`v2/bsky/drafts`の下書き`posts`配列の
 * 双方が参照する共有定数（NFR-7、`specs/entry/backend/requirements.md`参照）。
 *
 * このファイル自体は他に何もimportしない、依存を持たない定数のみのモジュールにする。
 * `src/lib/api/schema/**`配下のスキーマファイルは、コード生成ツール（`orval`、
 * 内部で`jiti`を使いTypeScriptの`paths`エイリアス（`@/*`）を解決しない）から
 * 相対importで読み込まれるため、依存グラフの大きい`src/lib/atproto/post.ts`
 * （atproto SDK呼び出し等、`@/`エイリアスに依存する多数のimportを持つ）を
 * そのまま相対importすると、その先の依存先で`@/`エイリアスの解決に失敗しjitiが
 * クラッシュする。この定数だけを依存の無い専用ファイルへ切り出すことで、
 * スキーマファイルからは軽量な相対importのみで済むようにしている。
 */
export const MAX_THREAD_POST_COUNT = 100
