# components 領域の構成

`src/components/` は React と Astro の部品の置き場。領域（機能の単位）の一覧は `.kiro/steering/structure.md` の「領域の一覧」を正とする。各領域の内部の関係は、その領域の `README.md` を参照（`common/`・`entry/`・`image/`）。

## 置き方の規則

- 部品は `<領域>/<Name>/`（`index.tsx` または `index.astro` と `index.module.css`）に置く。
- 部品 P の利用元がすべて部品 H の中にあるとき、P は H の子フォルダ（`H/P/`）に置く。例: `composer/ThreadComposer/ImagePicker/`、`timeline/Timeline/ThreadCard/PostCard/`。
- `common/` は汎用の部品だけを置く（呼び出し側の文言と状態を受け取り、業務を持たない）。`common/` と `layout/` の部品は、子フォルダに移さない。

## 文言の多言語対応

コンポーネントに日本語・英語の文言を直書きしない。文言は `src/lib/i18n/messages/` の辞書に定義し、React では `useT()`、`.astro` では `createTranslator(Astro.locals.locale)` で取得する。直書きは `tests/lib/i18n/noHardcodedText.test.ts` が検出する。手順の詳細は `docs/DEVELOP.md` の「多言語対応（i18n）」を参照。
