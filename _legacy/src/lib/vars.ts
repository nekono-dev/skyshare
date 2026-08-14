// 正しくbool値を処理。 `True` 以外は全て False として処理
const stringToBoolean = (value: string | null | undefined): boolean => {
    if (value == null) {
        return false
    }
    return value.toLowerCase() === "true"
}
