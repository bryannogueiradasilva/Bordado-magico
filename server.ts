import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { Storage } from "@google-cloud/storage";
import admin from "firebase-admin";
import multer from "multer";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Request Logger
  app.use((req, res, next) => {
    console.log(`📡 [${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE"],
  }));

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  const bucket = process.env.GCS_BUCKET_NAME || "appbordados";

  // =========================
  // 🔥 CORREÇÃO DEFINITIVA
  // =========================
  function getStorage() {
    return new Storage();
  }

  function getFirebaseAdmin() {
    if (admin.apps.length > 0) return admin.app();

    return admin.initializeApp({
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  }

  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
  });

  // =========================
  // 🔥 1. APIs PRIMEIRO (OBRIGATÓRIO)
  // =========================

  // Teste Status
  app.get("/api/gcs-status", (req, res) => {
    res.json({
      configured: true,
      details: {
        usingDefaultCredentials: true
      },
      bucket: bucket
    });
  });

  // Upload
  app.post("/api/upload-embroidery", upload.single("file"), async (req, res) => {
    console.log("🔥 CHEGOU UPLOAD");

    if (!req.file) {
      console.log("❌ SEM ARQUIVO");
      return res.status(400).json({ error: "Arquivo não enviado" });
    }

    console.log("📁 FILE:", req.file.originalname);

    try {
      const gcs = getStorage();
      const bucketObj = gcs.bucket(process.env.GCS_BUCKET_NAME || "appbordados");

      const fileName = `arquivos-matrizes/${Date.now()}-${req.file.originalname}`;
      const blob = bucketObj.file(fileName);

      const stream = blob.createWriteStream({
        resumable: false,
        contentType: req.file.mimetype,
      });

      stream.on("error", (err) => {
        console.error("🔥 ERRO GCS:", err);
        return res.status(500).json({ error: err.message });
      });

      stream.on("finish", () => {
        console.log("✅ UPLOAD FINALIZADO");

        const publicUrl = `https://storage.googleapis.com/${bucketObj.name}/${fileName}`;

        return res.json({
          success: true,
          url: publicUrl,
        });
      });

      stream.end(req.file.buffer);

    } catch (error: any) {
      console.error("🔥 ERRO GERAL:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Listar Arquivos
  app.get("/api/list-embroidery", async (req, res) => {
    try {
      const gcs = getStorage();
      const [files] = await gcs.bucket(bucket).getFiles({
        prefix: "arquivos-matrizes/"
      });

      const fileNames = files
        .map(file => file.name)
        .filter(name => name !== "arquivos-matrizes/");

      res.json({ files: fileNames });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete
  app.delete("/api/delete-embroidery", async (req, res) => {
    try {
      const gcs = getStorage();
      const { gcsPath } = req.body;

      if (!gcsPath) {
        return res.status(400).json({ error: "gcsPath is required" });
      }

      const bucketObj = gcs.bucket(bucket);
      await bucketObj.file(gcsPath).delete({ ignoreNotFound: true });

      const fileName = path.parse(gcsPath).name;
      const previewPath = `imagens-vitrine/${fileName}.png`;
      await bucketObj.file(previewPath).delete({ ignoreNotFound: true });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Teste de Assinatura (DEBUG)
  app.get("/api/gcs-test-sign", async (req, res) => {
    try {
      const gcs = getStorage();
      const [buckets] = await gcs.getBuckets();
      res.json({ 
        success: true, 
        message: "Conexão com GCS estabelecida com sucesso!",
        buckets: buckets.map(b => b.name)
      });
    } catch (error: any) {
      console.error("❌ Erro no teste de assinatura GCS:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        code: error.code,
        details: error.details
      });
    }
  });

  // Admin Users
  app.get("/api/admin/users", async (req, res) => {
    try {
      const adminApp = getFirebaseAdmin();
      const users = await adminApp.auth().listUsers();
      res.json({ users: users.users });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/users/:uid", async (req, res) => {
    try {
      const adminApp = getFirebaseAdmin();
      await adminApp.auth().deleteUser(req.params.uid);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Catch-all para rotas API não encontradas
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: "Rota API não encontrada", path: req.url });
  });

  // =========================
  // 🔥 2. FRONTEND DEPOIS
  // =========================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");

    app.use(express.static(distPath));

    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("💥 Erro não tratado:", err);
    res.status(err.status || 500).json({
      error: "Erro interno do servidor",
      details: err.message
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
  });
}

startServer();