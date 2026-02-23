import React, { useState } from "react"
import Overlay from "../Overlay"
import PostForm from "../PostForm"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"
import pic from "@/images/pen.svg"

const PostLauncher: React.FC<{ avatarUrl?: string | null }> = ({ avatarUrl }) => {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        className={`${ui.baseButton} ${ui.blueButton} ${ui.nontextButton} ${ui.lgButton} ${styles.launcherDelta}`}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
      >
        <img src={pic.src} width={24} height={24} />
      </button>

      <Overlay open={open} onClose={() => setOpen(false)}>
        <PostForm onClose={() => setOpen(false)} avatarUrl={avatarUrl} />
      </Overlay>
    </>
  )
}

export default PostLauncher
