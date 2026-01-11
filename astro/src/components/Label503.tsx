// https://note.com/depart_ninomiya/n/na48828742572
import { useEffect, useState } from "react"

const Label503 = () => {
    const [query, setQuery] = useState<string | undefined>(undefined)

    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search)
            const searchQuery = params.get("url")
            setQuery(searchQuery ?? undefined)
        }
    }, [])

    return query === undefined ? undefined : (
        <>
            Source post <a href={decodeURIComponent(query)}>here(Bluesky)</a>
        </>
    )
}

export default Label503
