# Design Document

## Overview

**Purpose**: 利用者が不具合の報告と新機能の提案を1つのフォームから送れるようにし、送る内容と自動で添える情報を送信の前に確かめられるようにする。
**Users**: 不具合の報告や新機能の提案を送りたいログイン中の利用者
**Impact**: 設定のページから辿れる単独のフォームを加え、送る内容と自動で添える情報を送信の前に確かめられるようにする。

### Goals

- 報告と提案のページと、設定のページからの導線。
- 種別の切り替えと、種別ごとの入力欄。
- 環境の情報の収集と、共有と公開の注記。
- 送信と、結果の表示。

### Non-Goals

- 入力の検証と Issue の登録。
- スクリーンショットの添付。

## Boundary Commitments

### This Spec Owns

- 報告と提案のページと、設定のページからの導線。
- 種別の切り替えと、種別ごとの入力欄。
- 環境の情報の収集と、共有と公開の注記。
- 送信と、結果の表示。

### Out of Boundary

- 入力の検証と Issue の登録。
- スクリーンショットの添付。

### Allowed Dependencies

- 受付の API と、入力の上限・再現の頻度の値（feedback-api）
- 文字数カウンタ付きの入力欄（counted-text-input）
- 表示言語の辞書（i18n-messages）
- ログイン中のアカウント情報（account-session）

### Revalidation Triggers

- 入力欄の構成・上限・再現の頻度の選択肢を変えるとき（feedback-api の入力と一致が要る）
- 自動で収集する環境の情報の項目を変えるとき（注記の文言も更新が要る）
- 設定のページからの導線を変えるとき

## Architecture

### Architecture Pattern & Boundary Map

ページとフォームの部品の依存方向を示す。

```mermaid
flowchart LR
  settings -->|リンク| page["pages/feedback"]
  page --> index
  index --> css["index.module"]
  index --> feedbackDraft
  index -->|collectClientEnvironment| clientEnvironment
  index --> ja["ja/feedback"]
  index --> en["en/feedback"]
  feedbackDraft --> ext_limits["入力の上限"]
  index --> ext_input["文字数カウンタ付きの入力欄"]
  index --> ext_api["受付の API"]
```

## File Structure Plan

| パス                                                    | 責務                                                     |
| ------------------------------------------------------- | -------------------------------------------------------- |
| `src/util/clientEnvironment.ts`                         | 識別文字列からの OS とブラウザの判定と、起動の形態の判定 |
| `src/lib/feedback/feedbackDraft.ts`                     | 入力の状態の型と、送信の可否と送信の本文の組み立て       |
| `src/components/feedback/FeedbackForm/index.tsx`        | ログインの確認・入力欄・注記・送信と結果の表示           |
| `src/components/feedback/FeedbackForm/index.module.css` | フォームの見た目                                         |
| `src/pages/feedback.astro`                              | 報告と提案の単独のページ                                 |
| `src/pages/settings.astro`                              | 設定のページの報告と提案へのリンク                       |
| `src/lib/i18n/messages/ja/feedback.ts`                  | 報告と提案の文言（日本語。正本）                         |
| `src/lib/i18n/messages/en/feedback.ts`                  | 報告と提案の文言（英語）                                 |

## System Flows

ページを開いてから送信の結果を示すまでの流れと分岐を示す。

```mermaid
sequenceDiagram
  participant index
  participant ext_session as セッションの API
  participant clientEnvironment
  participant feedbackDraft
  participant ext_api as 受付の API
  index->>ext_session: アカウントの取得
  alt 未ログイン
    index-->>index: ログインの案内
  else ログイン中
    index->>clientEnvironment: collectClientEnvironment
    clientEnvironment->>clientEnvironment: parseUserAgent
    clientEnvironment->>clientEnvironment: detectStandalone
    index->>feedbackDraft: emptyDraft
    index->>feedbackDraft: isDraftSubmittable
    index->>feedbackDraft: toFeedbackRequest
    index->>ext_api: 報告の送信
    alt 成功
      ext_api-->>index: Issue の番号と URL
    else 失敗
      ext_api-->>index: 状態の文言の表示
    end
  end
```

## Requirements Traceability

| Requirement                  | Summary          | Components |
| ---------------------------- | ---------------- | ---------- |
| 1.1, 1.2, 1.3                | ページと導線     | D-3, D-4   |
| 2.1, 2.2, 2.3, 2.4, 2.5, 2.6 | 種別ごとの入力欄 | D-2, D-3   |
| 3.1, 3.2                     | 送る内容の確認   | D-1, D-3   |
| 4.1, 4.2                     | 送信の結果       | D-3        |

## Components and Interfaces

#### D-1: 環境の情報の判定

**Requirements**: 3.2

```ts
export type ClientEnvironment = { os: string; browser: string; userAgent: string; standalone: boolean }
// 識別文字列から OS とブラウザの名前と版を返す。判定できない部分は "Unknown"
export const parseUserAgent = (ua: string, maxTouchPoints = 0): { os: string; browser: string }
// display-mode が standalone・fullscreen・minimal-ui か、iOS の navigator.standalone が true
export const detectStandalone = (win: Window): boolean
// userAgentData があれば高精度の値（platformVersion・fullVersionList）で OS とブラウザを補う
export const collectClientEnvironment = async (win: Window): Promise<ClientEnvironment>
```

| 判定     | 規則（上から順に最初に一致したもの）                                                                                        |
| -------- | --------------------------------------------------------------------------------------------------------------------------- |
| OS       | iPhone・iPad の `OS x_y` は iOS・iPadOS、`Macintosh` で触れる点が2以上は iPadOS、Android、Windows NT、Mac OS X、CrOS、Linux |
| ブラウザ | `EdgiOS`・`Edg`、`OPR`、`SamsungBrowser`、`FxiOS`・`Firefox`、`CriOS`・`Chrome`、`Version/x Safari`                         |
| Windows  | userAgentData の `platformVersion` の先頭が13以上なら 11、それ未満なら 10                                                   |

- ドメインの型を使わない汎用の処理として `src/util` に置く。

#### D-2: 入力の状態と送信の本文

**Requirements**: 2.1, 2.3, 2.4, 2.6

```ts
export type FeedbackKind = "bug" | "enhancement"
export type Reproducibility = (typeof REPRODUCIBILITY_VALUES)[number]
export type FeedbackDraft = {
  kind: FeedbackKind; title: string
  steps: string; reproducibility: Reproducibility | null
  description: string; technicalNotes: string
}
export const emptyDraft = (): FeedbackDraft
// 種別の必須の項目が空白だけでなく、すべての欄が上限以内なら true
export const isDraftSubmittable = (draft: FeedbackDraft): boolean
// 種別に合う項目だけを載せる。技術的な補足は空白だけなら省く
export const toFeedbackRequest = (
  draft: FeedbackDraft, env: ClientEnvironment, build: { version: string; commit: string | null },
): CreateFeedbackBody
```

- 種別を切り替えても他の種別の入力を保持し、送信の本文には載せない。
- 文字数は書記素で数え、上限は受付と共有の値を使う。
- 送信の後は `emptyDraft()` に戻し、種別だけを残す。

#### D-3: フォームの表示

**Requirements**: 1.3, 2.2, 2.5, 3.1, 4.1, 4.2

| 要素       | 内容                                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| ログイン   | `getSessionOnce` の401でフォームを出さず、ログインが必要な文言と `/login/` へのリンクを示す                            |
| 種別       | `RadioButton` を2つ横に並べる（不具合・新機能の提案）                                                                  |
| 件名       | `CountedTextInput`（1行）。見出しは `feedback.title.bug`・`feedback.title.enhancement` を種別で切り替える              |
| 本文       | `CountedTextInput`（複数行・自動伸長）。カウンタは `countFeedbackLength` で数え、上限を分母にする                      |
| 再現の頻度 | `RadioButton` を4つ（毎回起きる・ときどき起きる・起きない・試していない）                                              |
| 注記       | ハンドルと環境の情報の自動収集と開発者への共有、GitHub の公開の Issue に載ること、プライバシーポリシーへのリンクを示す |
| 送る値     | Bluesky（`@handle`）・Skyshare の版・コミットの先頭7文字・OS・ブラウザ・PWA の可否・識別文字列を項目名つきで並べる     |
| 送信       | `isDraftSubmittable` が false か送信中なら `disabled`                                                                  |
| 成功       | 完了の文言と Issue の URL へのリンク（新しいタブ）を示す                                                               |
| 失敗       | 429 は `feedback.error.rateLimited`、503 は `feedback.error.unavailable`、他は `errorMessageKeyFromStatus`             |

- 送る値の一覧は、送信の本文に載る値と同じものを表示する。

#### D-4: ページと導線と文言

**Requirements**: 1.1, 1.2

```astro
---
export const prerender = true
const robots = ["noindex", "nofollow", "noarchive", "noimageindex"]
---

<Baselayout pageTitleKey="pageTitle.feedback" robots={robots}>
  <h1 data-i18n="feedback.heading">…</h1>
  <FeedbackForm client:load />
  <StandaloneFooter />
</Baselayout>
```

- サイドバーとフッターナビの slot を渡さず、ナビの項目にも加えない。ナビがないため、フォームの下に設定のページへ戻るリンク（`feedback.back`）を置く。
- 設定のページは、ヘルプへのリンクの下に `/feedback/` へのリンク（`settings.feedbackLink`）を置く。
- 文言は辞書の `feedback.*` に置き、日本語を正本とし、英語は同じキー集合を型で強制される。

## Error Handling

| 事象                         | 処理                                     |
| ---------------------------- | ---------------------------------------- |
| セッションの取得が通信で失敗 | ログインの案内を示す                     |
| userAgentData の取得が失敗   | 識別文字列だけで判定した値を使う         |
| 送信が通信で失敗             | `error.network` の文言を示し、入力を残す |

## Testing Strategy

- Unit / Build Tests:
  - `npx vitest run tests/util/clientEnvironment.test.ts tests/lib/feedback/feedbackDraft.test.ts`
  - `npx tsc --noEmit`
- E2E/UI Tests:
  - `tests/e2e/feedbackForm.spec.ts` 設定のページのリンクから開いて種別を切り替えて送信する → 入力欄が切り替わり、Issue へのリンクが表示される
- テストの名前には、対応する基準 ID を `[feedback-form/<ID>]` の形で付ける（例: `[feedback-form/1.1]`）
