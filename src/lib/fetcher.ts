import { extractorApi } from "@/vars"

export const customFetcher = async <T>(
    url: string,
    options: RequestInit,
): Promise<T> => {
    if (url.startsWith("/v1/extract")) {
        url = extractorApi + url
    }
    const res = await fetch(url, options)
    // 安全にレスポンスを処理する: ボディが空や非JSONでも落ちないようにする
    const text = await res.text()
    let parsed: any = undefined
    if (text && text.length > 0) {
        try {
            parsed = JSON.parse(text)
        } catch (e) {
            parsed = text
        }
    }

    // orval 生成のクライアントが期待する形に整形して返す
    return {
        data: parsed,
        status: res.status,
        headers: res.headers,
    } as unknown as T
}
