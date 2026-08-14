import { useContext } from "react"
import { Profile_context } from "../common/contexts"
import { link } from "../common/tailwindVariants"
import { bskyProfileURL } from "@/env/bsky"

export const Component = () => {
    const { profile } = useContext(Profile_context)

    return (
        <>
            <img
                src={profile ? profile.avatar : undefined}
                className="w-10 h-10 mr-2 inline-block rounded-full bg-sky-400"
            />{" "}
            :
            <span className="mx-1 text-wrap align-middle">
                {profile ? profile.displayName : ""}
                {profile ? (
                    <a
                        href={new URL(
                            profile.handle,
                            bskyProfileURL,
                        ).toString()}
                        className={link({ class: "m-1" })}
                    >
                        @{profile.handle}
                    </a>
                ) : (
                    <></>
                )}
            </span>
        </>
    )
}

export default Component
