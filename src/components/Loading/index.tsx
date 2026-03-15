import styles from "./index.module.css"

type Props = {
  message?: string
  overlay?: boolean
}

export const Component = ({
  message = "処理中...",
  overlay = false,
}: Props) => {
  if (overlay) {
    return (
      <div className={styles.overlay} role="status" aria-live="polite">
        <div className={styles.panel}>
          <span className={styles.spinner} aria-hidden="true" />
          <p className={styles.message}>{message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.inline} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <p className={styles.message}>{message}</p>
    </div>
  )
}

export default Component
