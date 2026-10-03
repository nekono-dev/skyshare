# スマホレイアウトのUI拡大 設計書

## 1. 方針

`src/styles/tokens.css` に `@media (max-width: 639px) { :root { ... } }` を追加し、スマホ幅でトークン値自体を上書きする。各コンポーネントCSSは `var()` 参照のため、個別編集なしで追従する。ダークモードのブロックとは独立（色トークンは触れない）。

## 2. トークン値

| トークン           | PC   | スマホ |
| ------------------ | ---- | ------ |
| `--font-size-xs`   | 12px | 14px   |
| `--font-size-sm`   | 14px | 16px   |
| `--font-size-md`   | 16px | 18px   |
| `--font-size-lg`   | 18px | 20px   |
| `--font-size-xl`   | 20px | 22px   |
| `--font-size-2xl`  | 24px | 26px   |
| `--space-0`        | 2px  | 3px    |
| `--space-1`        | 4px  | 6px    |
| `--space-2`        | 8px  | 10px   |
| `--space-3`        | 12px | 16px   |
| `--space-4`        | 16px | 20px   |
| `--space-5`        | 24px | 28px   |
| `--space-6`        | 32px | 36px   |
| `--size-button-md` | 40px | 44px   |
| `--size-button-lg` | 60px | 64px   |

| `--size-icon-button`（新規。画像追加ボタン内のアイコン） | 18px | 26px |
| `--size-toggle-width` / `-height` / `-knob`（新規。ToggleSwitch） | 32 / 18 / 14px | 48 / 26 / 20px |
| `--size-avatar-sm` / `md` / `lg` | 36 / 48 / 60px | 42 / 56 / 70px |
| `--size-avatar-footer`（新規。フッターのアカウントアイコン） | 36px | 36px（据え置き） |
| `--font-size-input`（新規。本文入力フォーム） | md（16px） | lg（20px） |

`--btn-padding-x/y` は `--space-*` 参照のため自動で拡大する。

## 3. 直書きの置換

新規のフォントトークンは追加せず、近い既存トークンへ寄せる。

- `0.85rem` → `--font-size-xs`、`0.9rem` / `0.95rem` → `--font-size-sm`、`ui.module.css` の `.root` の `16px` → `--font-size-md`。
- 小余白（`0.05rem` `0.1rem` `0.15rem` `0.25rem` `0.6rem` `0.75rem` `2px`）は `--space-0` / `--space-1` / `--space-2` / `--space-3` へ寄せる。画像間隔（`ImageGallery` の `2px`）は据え置く。

## 4. 既存のスマホ個別指定の整理

二重拡大・逆行を避けるため、`ui.module.css` の `.base-padding`（スマホで縮小）、`input.ui.module.css` の `.base-input-field`（スマホで xl）、`EntryDetailView` の `.header-card` / `.error-pane`、`LoginForm` の 420px 指定を見直す。

## 5. 投稿フォームのレイアウト

`ThreadSegmentForm` のツールボックス（反応可能ユーザ選択・言語・画像添付・ラベル等）は、アバター列の下まで含めた全幅で配置する。先頭行（アバター＋本文）と全幅ツールボックスを縦に積む構成とし、編集表示の外枠（`data-testid="segment-editor"`）は両方を内包する。アバターの連結線は先頭行の範囲に限る。
