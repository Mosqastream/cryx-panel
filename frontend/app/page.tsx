import styles from "./home.module.css"

export default function HomePage() {
  return (
    <main className={styles.container}>
      <section className={styles.box}>
        <h1 className={styles.title}>Panel de Códigos</h1>
        <p className={styles.subtitle}>Consulta correos y códigos asignados</p>

        <div className={styles.actions}>
          <a href="/login" className={styles.btnPrimary}>Iniciar Sesión</a>
          <a href="/register" className={styles.btnSecondary}>Registrarse</a>
        </div>
      </section>
    </main>
  )
}
