"use client";

import { useState } from "react";
import styles from "./register.module.css";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    setError(null);
    setMsg(null);

    if (username.trim().length < 3) {
      setError("El nombre debe tener mínimo 3 caracteres.");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);

    // Creamos cuenta con email falso interno
    const emailFake = `${username}@fake.local`;

    const { data, error: supaError } = await supabase.auth.signUp({
      email: emailFake,
      password,
      options: {
        data: {
          username,
        },
      },
    });

    if (supaError) {
      setError(supaError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // Crear perfil
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: data.user.id,
          username,
          role: "user"
        });

      if (profileError) {
        setError("Error creando perfil: " + profileError.message);
        setLoading(false);
        return;
      }

      setMsg("Cuenta creada correctamente 🎉 Ahora inicia sesión.");
      setUsername("");
      setPassword("");
    }

    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.box}>
        <h2 className={styles.title}>Crear Cuenta</h2>

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
          <span
            className={styles.eye}
            onClick={() => setShowPass(!showPass)}
          >
            {showPass ? "🙈" : "👁️"}
          </span>
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {msg && <p className={styles.success}>{msg}</p>}

        <button
          className={styles.btn}
          disabled={loading}
          onClick={handleRegister}
        >
          {loading ? "Creando..." : "Registrarse"}
        </button>

        <p className={styles.bottom}>
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className={styles.link}>
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
