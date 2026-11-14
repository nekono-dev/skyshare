# Brief: help-privacy

## Problem

利用者は使い方と個人情報の扱いを確認できる必要がある。説明の文言と、運用者ごとに変わる値（運営者名・連絡先・分析タグの有無）が混ざると、説明と実装が食い違う。

## Current State

- `src/pages/help.astro`: 静的なページ（`prerender = true`、`noindex`）。`Help` を `client:load` で描画し、設定ページへの戻りを置く。
- `src/components/help/helpEntries.tsx`: FAQ の静的データ（`buildHelpEntries`）。文言は辞書にあり、翻訳関数を受け取る。`HelpItem.tsx`・`Help/index.tsx` が描画。
- `src/pages/privacy.astro`・`src/components/privacy/PolicyCards.tsx`: 節を縦に描画する。
- `src/lib/privacy/policySections.ts`: 節の順序を固定し、辞書から見出しと本文を組み立てる。運営者名・連絡先・日付は `lib/site/siteConfig.ts` から受け取る。分析を使わない設定（`PUBLIC_GA_MEASUREMENT_ID` が無い）では分析の節を除く。窓口の Bluesky が未設定なら連絡先から除く。

## Desired Outcome

- ヘルプの項目の構成と、表示の条件が記録されている。
- プライバシーポリシーの節の構成と、運用者の値で変わる箇所が記録されている。
- 辞書と実装の事実が食い違ったときに、両方を同じ変更で直す規則が記録されている。

## Approach

表示の仕組みと、運用者の値による分岐を所有する。文言の中身は辞書として記録する。

## Scope

- **In**: ヘルプの FAQ、プライバシーポリシーの節と分岐、表示ページ。
- **Out**: 文言の翻訳品質、法的な助言、運用者の値の定義（platform-runtime）、言語の判定（i18n）。

## Boundary Candidates

- ヘルプ（helpEntries.tsx・HelpItem・Help・help.astro）
- プライバシーポリシー（policySections.ts・PolicyCards・privacy.astro）

## Out of Boundary

- 運用者の値の定義、言語の判定

## Upstream / Downstream

- **Upstream**: i18n、ui-primitives、platform-runtime（サイト設定）。
- **Downstream**: なし。

## Existing Spec Touchpoints

- **Extends**: なし。
- **Adjacent**: platform-runtime（`siteConfig`）。

## Constraints

- 扱う情報や保存期間などの事実を変えたら、辞書を同じ変更で更新する。
- 既知の不一致: なし（確認済みの範囲）。

## 確定した判断（2026-10-24）

- プライバシーポリシーは、海外で一般的なテンプレート（運営者と連絡先・収集する情報・利用目的・共有・保持期間・セキュリティ・Cookie・ユーザーの権利・変更）に沿って簡潔に書く。
- 条番号や法令の言い回し、個人情報保護法 32 条の公表事項の網羅は書かない。
- 連絡先は活動名・メールアドレス・Bluesky アカウントへのリンク。
- 各文は実装の事実（保持期間・委託先・誰が記録しているか）と合っていることを確かめる。例: アクセスログは運営者が主体的に記録していないので、Cloudflare が扱う情報として書く。
- 変更の経緯は、ソースコードと spec に残さない。
- 最終改定日だけを持ち、本番（main）に初めて出す日に登録する（DEVELOP.md 5.0）。公開前の本文の変更は改定にしない。制定日（`PUBLIC_PRIVACY_ENACTED_AT`）は、利用者の決定（2026-11-14）で表示・設定・環境変数のすべてから廃止した。
