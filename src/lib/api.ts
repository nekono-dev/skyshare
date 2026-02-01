// headersオブジェクトを通常のオブジェクトに変換するユーティリティ関数
export const convertHeaderToObj = (headers: Headers) => {
    const headersObj: Record<string, string> = {}

    headers.forEach((value: string, key: string) => {
        headersObj[key] = value
    })
    return headersObj
}

export const errorResponseFromStatus = (status: number): Response => {
    console.log(`API Error Response: ${status}`)
    const message = { error: "Unknown Error" }
    switch (status) {
        case 400:
            message.error = "Bad Request"
            break
        case 401:
            message.error = "Unauthorized"
            break
        case 403:
            message.error = "Forbidden"
            break
        case 404:
            message.error = "Not Found"
            break
        case 429:
            message.error = "Too Many Requests"
            break
        default:
            message.error = "Internal Server Error"
            break
    }
    return new Response(JSON.stringify(message), {
        status: status,
        headers: { "content-type": "application/json" },
    })
}
