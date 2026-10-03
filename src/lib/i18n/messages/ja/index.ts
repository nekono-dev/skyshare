/**
 * 日本語辞書。ドメイン別ファイルを結合する。
 * この辞書のキー集合が `MessageKey` の基準であり、英語辞書は同一キー集合を型で強制される。
 */
import { account } from "./account"
import { common } from "./common"
import { entry } from "./entry"
import { error } from "./error"
import { guest } from "./guest"
import { image } from "./image"
import { nav } from "./nav"
import { page } from "./page"
import { post } from "./post"
import { settings } from "./settings"

export const ja = {
    ...account,
    ...common,
    ...entry,
    ...error,
    ...guest,
    ...image,
    ...nav,
    ...page,
    ...post,
    ...settings,
} as const
