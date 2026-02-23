import React from "react"
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

  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        className={contentClassName ? contentClassName : styles.content}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

export default Overlay
