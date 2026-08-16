# components/Client/bskyについて

本ディレクトリのコンポーネント配置について記載します。

## types.ts

`components/Client/bsky`内で用いる共通のtype情報を記載します。

## LoginForm.tsx

Blueskyのログイン画面を構成する、コンポーネントをまとめるコンポーネントです。OAuth採用後は使えなくなる恐れがあるため、別の対応が必要です。

## PostForm.tsx

クライアントの大部分を示す、コンポーネントをまとめるコンポーネントです。他のコンポーネントを取りまとめます。

# 各種ディレクトリとその中身の役割について

## lib/

`components/Client/bsky`に依存した関数です。コンポーネントが呼び出して利用します。

## unique/

特定の基礎を持たず、単体で完結しているコンポーネントです。コンポーネントをまとめるコンポーネントはこれに含めません。

## optionToggles/

`components/Client/common/ToggleSwitch.tsx`を基礎とした拡張コンポーネントです。

## buttons/

`components/Client/common/ProcButton.tsx`を基礎とした拡張コンポーネントです。

## selectLists/

`components/Client/common/SelectList.tsx`を基礎とした拡張コンポーネントです。

## MediaPreview/

メディアのプレビューコンポーネントならびに、これを実現するための子コンポーネントです。
