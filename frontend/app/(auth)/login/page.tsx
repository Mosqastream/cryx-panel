"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
  setError(null);

  if (username.trim().length < 3) {
    setError("Usuario inválido.");
    return;
  }
  if (password.length < 6) {
    setError("Contraseña demasiado corta.");
    return;
  }

  setLoading(true);

  const fakeEmail = `${username}@fake.local`;

  const { data, error: authError } = await supabase.auth.signInWithPassword({
    email: fakeEmail,
    password
  });

  if (authError) {
    setError("Credenciales inválidas o usuario inexistente.");
    setLoading(false);
    return;
  }

  const sessionUser = data.user;

  // 🔥 OBTENER PROFILE YA AUTENTICADO
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", sessionUser.id)
    .single();

  if (profile?.role === "admin") {
    router.push("/admin");
  } else {
    router.push("/dashboard");
  }

  setLoading(false);
};


  return (
    <div className={styles.container}>
      <div className={styles.box}>
        <h2 className={styles.title}>Iniciar Sesión</h2>

        <input
          className={styles.input}
          placeholder="Nombre de usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <div className={styles.passWrapper}>
          <input
            className={styles.input}
            type={showPass ? "text" : "password"}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className={styles.eye} onClick={() => setShowPass(!showPass)}>
            {showPass ? "🙈" : "👁️"}
          </span>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button
          className={styles.btn}
          disabled={loading}
          onClick={handleLogin}
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </button>

        <p className={styles.bottom}>
          ¿No tienes cuenta?{" "}
          <Link href="/register" className={styles.link}>Crear cuenta</Link>
        </p>
      </div>
    </div>
  );
}
