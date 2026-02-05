// backend/index.js
import express from "express";
import cors from "cors";
import { fetchEmailsForAlias } from "./imapWorker.js";

const app = express();

const allowedOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";

app.use(cors({ origin: allowedOrigin }));
app.use(express.json());


app.get("/", (req, res) => {
  res.send("Servidor IMAP funcionando ✔");
});

app.get("/emails", async (req, res) => {
  try {
    const raw = req.query.alias;
    if (!raw || String(raw).trim() === "") {
      return res.status(400).json({ error: "Alias requerido" });
    }

    let alias = String(raw).trim();

    // 🔥 normalización fuerte
    if (alias.includes("@")) {
      alias = alias.split("@")[0];
    }

    console.log("📨 Consultando alias:", alias);

    const emails = await fetchEmailsForAlias(alias);

    return res.status(200).json({
      alias,
      emails: emails || [],
    });
  } catch (err) {
    console.error("❌ ERROR /emails:", err);
    return res.status(500).json({
      error: "Error interno consultando correos",
    });
  }
});

const PORT = process.env.PORT || 4001;

app.listen(PORT, () => {
  console.log(`🚀 Servidor IMAP corriendo en puerto ${PORT}`);
});

