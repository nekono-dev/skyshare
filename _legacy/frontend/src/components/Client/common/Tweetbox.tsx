import { ReactNode } from "react"
export const Component = ({ children }: { children: ReactNode }) => {
    return (
        <div
            className="mx-auto
                        sm:max-w-xl 
                        bg-white 
                        rounded-lg
                        sm:border-[20px]
                        sm:border-y-[10px]
                        border-white 
                        shadow-md
                        py-2 border-y-8"
        >
            {children}
        </div>
    )
}

export default Component
