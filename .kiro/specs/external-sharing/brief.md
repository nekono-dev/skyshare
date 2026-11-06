# Brief: external-sharing

## Problem

投稿を X・タイッツー・Mastodon・Misskey などの他 SNS にも共有できる。共有先ごとに文字数・URL の扱い・ポップアップの制限が違い、ブラウザのポップアップ制限を避ける工夫もいる。

## Current State

- 共有先の選択: `src/components/share/IntentShareDialog/index.tsx`。X・タイッツーは「長文を省略して共有」の設定に従う。Mastodon・Misskey は省略しない。
- ポップアップ: `src/util/share/openIntentPopup.ts` は投稿の完了より前に空のウィンドウを開き、完了後に `location.href` で移す。`src/pages/jump.astro` は移るまでの受け皿（4 秒後に案内を出す）。
- Web Share: `src/util/share/webShare.ts`。`components/share/useWebShareCrosspost.ts` は Entry の有無で共有の内容を変える（Entry あり: 本文と Entry の URL。Entry なし・画像あり: 画像を files として。なし: 本文）。
- 文字数: `src/util/share/intentLength.ts`・`truncateText.ts`。`src/lib/share/counterReserve.ts` は末尾の URL 分を上限から引く。
- 本文と URL: `src/lib/share/shareBody.ts`。「Skyshare のリンクカードを優先表示」が ON で Entry の URL を含むとき、本文の URL を取り除き、リンクカードの URL を補わない。
- 投稿後の分岐: `components/composer/ThreadComposer/shareDispatch.ts`（自動ポップアップの対象、WebShare・ポップアップ・投稿先選択の分岐。React の state には触れず、結果を返す）。
- 旧共有設定の引き継ぎ: `src/lib/settings/legacyShareSettings.ts`（公開済みの旧形式を読み替える）。

## Desired Outcome

- 共有先ごとの文字数・URL・省略の規則が記録されている。
- 投稿後の分岐（ポップアップ・Web Share・選択ダイアログ）が記録されている。
- ポップアップが開けないときの扱いが記録されている。

## Approach

共有の組み立てと実行を所有する。共有の既定値の保存は settings が所有し、本 spec は値を読む。

## Scope

- **In**: 共有先の選択とダイアログ、ポップアップの開き方と遷移、Web Share、共有文の組み立て、文字数の補正、投稿後の分岐、リンクカードの優先、旧共有設定の引き継ぎ、`/jump`。
- **Out**: 共有の既定値の保存（settings）、投稿の書き込み（post-composition）、Entry の作成（entry-sharing）、各 SNS の仕様。

## Boundary Candidates

- 共有先とダイアログ（IntentShareDialog）
- ポップアップと Web Share（util/share/・jump.astro・useWebShareCrosspost.ts）
- 共有文と文字数（lib/share/・intentLength.ts・truncateText.ts）
- 投稿後の分岐（shareDispatch.ts・legacyShareSettings.ts）

## Out of Boundary

- 既定値の保存、投稿の書き込み、Entry の作成、各 SNS の仕様

## Upstream / Downstream

- **Upstream**: entry-sharing（Entry の URL と画像）、settings（既定値）、i18n、ui-primitives、platform-runtime（`/jump` の配置）。
- **Downstream**: post-composition（投稿後の分岐を呼ぶ）、timeline-browsing（PostCard の Web Share）。

## Existing Spec Touchpoints

- **Extends**: なし。
- **Adjacent**: settings、post-composition。

## Constraints

- 文字数の換算は現行の実装の値を記録する。各 SNS の仕様の変更は対象外。
- 既知の不一致: `shareDispatch.ts` の説明に旧 spec 名がある（根拠にしない）。
