import React from "react"
import { createPortal } from "react-dom"
import styles from "./index.module.css"

type Props = {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  contentClassName?: string
}

const Overlay: React.FC<Props> = ({
  open,
  onClose,
  children,
  contentClassName,
}) => {
  if (!open) return null

  const overlay = (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        className={[styles.content, contentClassName].filter(Boolean).join(" ")}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )

  if (typeof document === "undefined") {
    return overlay
  }

  return createPortal(overlay, document.body)
}

export default Overlay
