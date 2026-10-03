/**
 * Bluesky投稿言語コードと国旗絵文字の対応。
 *
 * 責務と処理概要:
 * - 言語コードごとに代表国（ISO 3166-1 alpha-2）を1つ定義し、国旗絵文字へ変換する。
 * - 国を持たない言語（人工言語・古典言語など）や判断に迷う言語はキーを持たず、旗なしとする。
 */
import { countryCodeToFlagEmoji } from "@/util/emoji/countryFlag"

/** 言語コード → 代表国。国旗を出さない言語はキー自体を持たない */
export const LANGUAGE_REPRESENTATIVE_COUNTRY: Record<string, string> = {
    af: "ZA",
    ak: "GH",
    am: "ET",
    ar: "SA",
    as: "IN",
    az: "AZ",
    be: "BY",
    bg: "BG",
    bho: "IN",
    bi: "VU",
    bm: "ML",
    bn: "BD",
    bo: "CN",
    br: "FR",
    bs: "BA",
    ca: "ES",
    cs: "CZ",
    cy: "GB",
    da: "DK",
    de: "DE",
    dv: "MV",
    dz: "BT",
    el: "GR",
    en: "US",
    es: "ES",
    et: "EE",
    eu: "ES",
    fa: "IR",
    fi: "FI",
    fil: "PH",
    fj: "FJ",
    fo: "FO",
    fr: "FR",
    ga: "IE",
    gd: "GB",
    gl: "ES",
    gu: "IN",
    ha: "NG",
    he: "IL",
    hi: "IN",
    hr: "HR",
    ht: "HT",
    hu: "HU",
    hy: "AM",
    id: "ID",
    ig: "NG",
    is: "IS",
    it: "IT",
    ja: "JP",
    jv: "ID",
    ka: "GE",
    kk: "KZ",
    kl: "GL",
    km: "KH",
    kn: "IN",
    ko: "KR",
    ky: "KG",
    lb: "LU",
    lo: "LA",
    lt: "LT",
    lv: "LV",
    mg: "MG",
    mh: "MH",
    mi: "NZ",
    mk: "MK",
    ml: "IN",
    mn: "MN",
    mr: "IN",
    ms: "MY",
    mt: "MT",
    my: "MM",
    na: "NR",
    nb: "NO",
    ne: "NP",
    nn: "NO",
    no: "NO",
    oc: "FR",
    or: "IN",
    pa: "IN",
    pl: "PL",
    ps: "AF",
    pt: "BR",
    qu: "PE",
    rn: "BI",
    ro: "RO",
    ru: "RU",
    rw: "RW",
    sd: "PK",
    sg: "CF",
    si: "LK",
    sk: "SK",
    sl: "SI",
    sm: "WS",
    sn: "ZW",
    so: "SO",
    sq: "AL",
    sr: "RS",
    st: "LS",
    su: "ID",
    sv: "SE",
    sw: "TZ",
    ta: "IN",
    te: "IN",
    tg: "TJ",
    th: "TH",
    ti: "ER",
    tk: "TM",
    tn: "BW",
    to: "TO",
    tr: "TR",
    ug: "CN",
    uk: "UA",
    ur: "PK",
    uz: "UZ",
    vi: "VN",
    xh: "ZA",
    yo: "NG",
    zh: "CN",
    zu: "ZA",
}

/**
 * 言語コードを代表国の国旗絵文字へ変換する。
 *
 * Input:
 * - `languageCode`: Bluesky投稿言語コード
 *
 * Output:
 * - 国旗絵文字。国旗なしの言語は `undefined`
 *
 * 例:
 * - 入力: `"ja"` → `"🇯🇵"`
 * - 入力: `"eo"` → `undefined`
 */
export const languageCodeToFlagEmoji = (
    languageCode: string,
): string | undefined => {
    const country = LANGUAGE_REPRESENTATIVE_COUNTRY[languageCode]
    return country === undefined ? undefined : countryCodeToFlagEmoji(country)
}
