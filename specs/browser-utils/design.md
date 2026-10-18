# ブラウザ向けの汎用処理 設計書

## 1. 構成

| パス                           | 責務                           |
| ------------------------------ | ------------------------------ |
| `src/util/object.ts`           | オブジェクトの判定             |
| `src/util/scrollLock.ts`       | スクロールの固定の参照カウント |
| `src/util/waitForImageLoad.ts` | 画像の読み込みの待機           |

## 2. 関係図・ワークフロー

- なし

## 3. 設計項目

### D-1: オブジェクトの判定 (FR-1)

```ts
export const isObjectRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
```

### D-2: スクロールの固定 (FR-2, FR-3)

```ts
let lockCount = 0
export const acquireScrollLock = (): void // 0 → 1 のときだけ位置と body の style を保存し、position: fixed; top: -<scrollY>px にする
export const releaseScrollLock = (): void // 1 → 0 のときだけ style を復元し、保存した位置へ scrollTo する
```

- 固定中は `window.scrollY` が 0 になるため、2 件目以降の要求では位置を保存し直さない。
- `document` が無い環境では何もしない。

### D-3: 画像の読み込みの待機 (FR-4, FR-5, FR-6)

```ts
// 既定の上限は 15000 ミリ秒、再試行の間隔は 1000 ミリ秒
export const waitForImageLoad = async (url: string, options: { timeoutMs?: number; intervalMs?: number } = {}): Promise<boolean>
```

| 条件                           | 結果                      |
| ------------------------------ | ------------------------- |
| URLが空、または `Image` が無い | 待たずに `false`          |
| 読み込めた                     | `true`                    |
| 失敗し、次の再試行が上限に届く | `false`（例外は投げない） |
| 失敗し、上限に届かない         | 間隔を空けて再試行する    |

## 4. エラー処理

| 事象                   | 処理                        |
| ---------------------- | --------------------------- |
| 上限までに読み込めない | 例外を投げず `false` を返す |
