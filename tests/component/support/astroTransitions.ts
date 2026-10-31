// component 層の検証用の `astro:transitions/client` の代わり（Astro の実行環境が無いため）。
// 画面遷移は実際には行わず、呼び出しはテストで差し替えられるよう no-op にする。
export const navigate = (_href: string, _options?: unknown): void => {}
