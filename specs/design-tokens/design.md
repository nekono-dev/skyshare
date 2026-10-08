# スマホ幅のUI拡大 設計書

## 1. 構成

| パス                              | 責務                                                       |
| --------------------------------- | ---------------------------------------------------------- |
| `src/styles/tokens.css`           | 余白・フォント・トグル寸法のトークン定義とスマホ幅の上書き |
| `src/styles/button.ui.module.css` | ボタン寸法トークンの定義とスマホ幅の上書き                 |
| `src/styles/avatar.ui.module.css` | アバター寸法トークンの定義とスマホ幅の上書き               |
| `src/styles/ui.module.css`        | フッターナビゲーション分の下余白クラス                     |

## 2. 設計項目

### D-1: トークンの上書き (FR-1, FR-2, FR-4)

境界はフッターナビゲーションとサイドバーの切り替え境界と同じ `max-width: 639px` とする。トークンは定義したファイル側で上書きし、import 順による上書きの取りこぼしを防ぐ。

| トークン                                             | 640px以上                       | 639px以下                        | 定義ファイル           |
| ---------------------------------------------------- | ------------------------------- | -------------------------------- | ---------------------- |
| `--font-size-xs` / `sm` / `md` / `lg` / `xl` / `2xl` | 12 / 14 / 16 / 18 / 20 / 24px   | 14 / 16 / 18 / 20 / 22 / 26px    | `tokens.css`           |
| `--space-0` 〜 `--space-6`                           | 2 / 4 / 8 / 12 / 16 / 24 / 32px | 3 / 6 / 10 / 16 / 20 / 28 / 36px | `tokens.css`           |
| `--size-icon-button`                                 | 18px                            | 26px                             | `tokens.css`           |
| `--font-size-input`                                  | `--font-size-md`                | `--font-size-lg`                 | `tokens.css`           |
| `--size-toggle-width` / `height` / `knob`            | 32 / 18 / 14px                  | 48 / 26 / 20px                   | `tokens.css`           |
| `--size-button-md` / `lg`                            | 40 / 60px                       | 44 / 64px                        | `button.ui.module.css` |
| `--size-avatar-sm` / `md` / `lg`                     | 36 / 48 / 60px                  | 42 / 52 / 70px                   | `avatar.ui.module.css` |
| `--size-avatar-footer`                               | 36px                            | 36px                             | `avatar.ui.module.css` |

`--btn-padding-x` / `--btn-padding-y` は `--space-*` を参照するため、上書きに追従する。

### D-2: 直書きの置換 (FR-3)

| 直書きの値                               | 置換先           |
| ---------------------------------------- | ---------------- |
| `0.85rem`                                | `--font-size-xs` |
| `0.9rem` / `0.95rem`                     | `--font-size-sm` |
| `16px`（フォント）                       | `--font-size-md` |
| `0.05rem` / `0.1rem` / `0.15rem` / `2px` | `--space-0`      |
| `0.25rem`                                | `--space-1`      |
| `0.6rem`                                 | `--space-2`      |
| `0.75rem`                                | `--space-3`      |

画像ギャラリーの画像間隔（2px）は寸法として固定し、置換しない。

### D-3: フッターナビゲーション分の下余白 (FR-5, NFR-1)

```css
@media (max-width: 639px) {
  /* ナビゲーション付きページの body 末尾 */
  :local(.root.with-nav) {
    padding-bottom: var(--nav-bar-height);
  }
  /* 別スクロール文脈の一覧末尾・余白要素を持たないページ本文に個別付与する */
  :local(.footer-nav-spacing) {
    padding-bottom: var(--nav-bar-height);
  }
}
```

## 3. エラー処理

- なし
