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
  const bucket = process.env.GCS_BUCKET_NAME || "appbordados";

  // Diagnostic endpoint
  app.get("/api/gcs-status", (req, res) => {
    const hasJson = !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    res.json({
      configured: hasJson,
      bucket: bucket
    });
  });

  app.get("/api/list-embroidery", async (req, res) => {
    try {
      const gcs = getStorage();
      const [files] = await gcs.bucket(bucket).getFiles({ prefix: "arquivos-matrizes/" });
      const fileNames = files.map(file => file.name).filter(name => name !== "arquivos-matrizes/");
      res.json({ files: fileNames });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/delete-embroidery", express.json(), async (req, res) => {
    try {
      const gcs = getStorage();
      const { gcsPath } = req.body;
      if (!gcsPath) return res.status(400).json({ error: "gcsPath is required" });

      const bucketObj = gcs.bucket(bucket);
      
      // Delete the main embroidery file
      await bucketObj.file(gcsPath).delete({ ignoreNotFound: true });
      
      // Also attempt to delete the generated preview image
      // gcsPath is "arquivos-matrizes/123-file.pes"
      // preview is "imagens-vitrine/123-file.png"
      const fileName = path.parse(gcsPath).name;
      const previewPath = `imagens-vitrine/${fileName}.png`;
      await bucketObj.file(previewPath).delete({ ignoreNotFound: true });

      res.json({ success: true, message: "Files deleted from GCS" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

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
      const blob = gcs.bucket(bucket).file(fileName);
      const stream = blob.createWriteStream({ resumable: false, contentType: req.file.mimetype });
      
      stream.on("finish", () => {
        const publicUrl = `https://storage.googleapis.com/${bucket}/${fileName}`;
        // O preview é gerado pela Cloud Function com o mesmo nome base mas extensão .png
        const baseName = path.parse(fileName).name;
        const previewUrl = `https://storage.googleapis.com/${bucket}/imagens-vitrine/${baseName}.png`;
        
        res.json({ 
          success: true, 
          gcsPath: fileName,
          publicUrl,
          previewUrl
        });
      });
      
      stream.end(req.file.buffer);
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  // A LINHA QUE MATA O ERRO:
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Bordado Mágico online na porta ${PORT}`);
  });
}

startServer();