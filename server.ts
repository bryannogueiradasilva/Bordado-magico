import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { Storage } from "@google-cloud/storage";
import admin from "firebase-admin";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 8080;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  const bucketName = process.env.GCS_BUCKET_NAME || "appbordados";

  function getCredentials() {
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (credentialsJson && credentialsJson.trim().startsWith('{')) {
      try { return JSON.parse(credentialsJson); } catch (e) { console.error("Erro JSON:", e); }
    }
    return null;
  }

  function getStorage() {
    const creds = getCredentials();
    return creds ? new Storage({ credentials: creds }) : new Storage();
  }

  function getFirebaseAdmin() {
    if (admin.apps.length > 0) return admin.app('admin-app');
    const creds = getCredentials();
    const options: admin.AppOptions = { databaseURL: process.env.FIREBASE_DATABASE_URL };
    if (creds) options.credential = admin.credential.cert(creds);
    return admin.initializeApp(options, 'admin-app');
  }

  const upload = multer({ storage: multer.memoryStorage() });

  // --- SUAS ROTAS MANTIDAS ---
  app.get("/api/admin/users", async (req, res) => {
    try {
      const adminApp = getFirebaseAdmin();
      const users = await adminApp.auth().listUsers();
      res.json({ users: users.users });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.delete("/api/admin/users/:uid", async (req, res) => {
    try {
      const adminApp = getFirebaseAdmin();
      await adminApp.auth().deleteUser(req.params.uid);
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.post("/api/upload-embroidery", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).send("Sem arquivo");
    try {
      const gcs = getStorage();
      const fileName = `arquivos-matrizes/${Date.now()}-${req.file.originalname}`;
      const blob = gcs.bucket(bucketName).file(fileName);
      const stream = blob.createWriteStream({ resumable: false, contentType: req.file.mimetype });
      stream.on("finish", () => res.json({ success: true, gcsPath: fileName }));
      stream.end(req.file.buffer);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  // A LINHA QUE MATA O ERRO:
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Bordado Mágico online na porta ${PORT}`);
  });
}

startServer();