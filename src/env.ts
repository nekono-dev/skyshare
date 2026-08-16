export const atpService =
    import.meta.env.PUBLIC_DEFAULT_ATP_SERVICE ?? "https://api.bsky.app"
export const plcDirectoryBaseUrl =
    import.meta.env.PUBLIC_PLC_DIRECTORY_BASE_URL ?? "https://plc.directory"
// legacy backend(pageDB)への接続先。/posts配下の旧投稿表示ページから参照する。
export const v1Endpoint = import.meta.env.PUBLIC_LEGACY_BACKEND_ENDPOINT ?? ""
