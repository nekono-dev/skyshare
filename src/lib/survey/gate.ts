/**
 * `gate/` への分割の過渡期の入口。元の export 名をすべて `./gate/` の各ファイルから再エクスポートする。
 * task 7.2 で `gate/index.ts` を作り、このファイルは削除する。
 */
export * from "./gate/state"
export * from "./gate/check"
export * from "./gate/runtime"
