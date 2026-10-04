/**
 * 英語辞書。日本語辞書と同一のキー集合を持つことを、型（`EnglishMessages`）で強制する。
 * 複数形を持つ文言は、日本語の `_other` に加えて `_one` を必ず定義する。
 */
import type { EnglishMessages } from "../../translate"
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
import { video } from "./video"

export const en: EnglishMessages = {
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
    ...video,
}
