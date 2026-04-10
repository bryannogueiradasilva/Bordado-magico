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
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // GCS Setup
  let storage: Storage | null = null;
  let firebaseAdmin: admin.app.App | null = null;
  const bucketName = process.env.GCS_BUCKET_NAME || "appbordados";

  function getCredentials() {
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (credentialsJson) {
      try {
        if (credentialsJson.trim().startsWith('{')) {
          return JSON.parse(credentialsJson);
        }
      } catch (e) {
        console.error("Erro ao processar GOOGLE_APPLICATION_CREDENTIALS_JSON:", e);
      }
    }
    // Se não houver JSON, o SDK usará automaticamente GOOGLE_APPLICATION_CREDENTIALS (caminho do arquivo)
    // ou as credenciais padrão do ambiente (Cloud Run).
    return null;
  }

  function getStorage() {
    if (!storage) {
      const credentials = getCredentials();
      try {
        if (credentials) {
          storage = new Storage({ credentials });
        } else {
          // Fallback para credenciais padrão (funciona no Cloud Run se a conta de serviço tiver permissão)
          storage = new Storage();
        }
        console.log("GCS Storage inicializado com sucesso.");
      } catch (e: any) {
        console.warn("Falha ao inicializar GCS Storage:", e.message);
      }
    }
    return storage;
  }

  function getFirebaseAdmin() {
    if (!firebaseAdmin) {
      const credentials = getCredentials();
      try {
        const dbUrl = process.env.FIREBASE_DATABASE_URL || (credentials ? `https://${credentials.project_id}.firebaseio.com` : undefined);
        
        const options: admin.AppOptions = {
          databaseURL: dbUrl
        };

        if (credentials) {
          options.credential = admin.credential.cert(credentials);
        }
        // Se não houver credentials, o admin.initializeApp() tentará usar o Application Default Credentials

        firebaseAdmin = admin.initializeApp(options, 'admin-app');
        console.log(`Firebase Admin inicializado com sucesso. DB: ${dbUrl}`);
      } catch (e: any) {
        console.error("Falha ao inicializar Firebase Admin:", e.message);
        return null;
      }
    }
    return firebaseAdmin;
  }

  const upload = multer({ storage: multer.memoryStorage() });

  // Diagnostic endpoint to help user check configuration
  app.get("/api/gcs-status", (req, res) => {
    const hasJson = !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    const bucket = process.env.GCS_BUCKET_NAME || "appbordados";
    const isJsonValid = hasJson && process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!.trim().startsWith('{');
    
    res.json({
      configured: !!getStorage(),
      envVars: {
        GOOGLE_APPLICATION_CREDENTIALS_JSON: hasJson ? (isJsonValid ? "Present (Valid JSON format)" : "Present (Invalid format - must start with { )") : "Missing",
        GCS_BUCKET_NAME: bucket
      },
      instructions: "To fix 'GCS not configured', go to Settings -> Secrets in AI Studio and add GOOGLE_APPLICATION_CREDENTIALS_JSON with the full content of your service account JSON file."
    });
  });

  // API Routes
  // User Management (Admin)
  app.get("/api/admin/users", async (req, res) => {
    const adminApp = getFirebaseAdmin();
    if (!adminApp) return res.status(500).json({ error: "Firebase Admin not configured" });

    try {
      const listUsersResult = await adminApp.auth().listUsers();
      res.json({ users: listUsersResult.users });
    } catch (error: any) {
      console.error("List Users Error:", error);
      // If Identity Toolkit API is disabled or other auth errors, return empty list with warning
      if (error.code === 'auth/internal-error' || error.message?.includes('Identity Toolkit API')) {
        return res.json({ 
          users: [], 
          warning: "Identity Toolkit API is disabled in Google Cloud Console. User management via Firebase Admin is limited.",
          details: error.message
        });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/users/:uid", express.json(), async (req, res) => {
    const { uid } = req.params;
    const { email, password, displayName } = req.body;
    const adminApp = getFirebaseAdmin();
    if (!adminApp) return res.status(500).json({ error: "Firebase Admin not configured" });

    try {
      const updateData: any = {};
      if (email) updateData.email = email;
      if (password) updateData.password = password;
      if (displayName) updateData.displayName = displayName;

      const userRecord = await adminApp.auth().updateUser(uid, updateData);
      res.json({ success: true, user: userRecord });
    } catch (error: any) {
      console.error("Update User Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/users/:uid", async (req, res) => {
    const { uid } = req.params;
    const adminApp = getFirebaseAdmin();
    if (!adminApp) return res.status(500).json({ error: "Firebase Admin not configured" });

    try {
      await adminApp.auth().deleteUser(uid);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete User Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/list-embroidery", async (req, res) => {
    const gcs = getStorage();
    if (!gcs) return res.status(500).json({ error: "GCS not configured" });

    try {
      const [files] = await gcs.bucket(bucketName).getFiles({ prefix: "arquivos-matrizes/" });
      const fileNames = files.map(file => file.name);
      res.json({ files: fileNames });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/delete-embroidery", express.json(), async (req, res) => {
    const gcs = getStorage();
    if (!gcs) return res.status(500).json({ error: "GCS not configured" });

    const { gcsPath } = req.body;
    if (!gcsPath) return res.status(400).json({ error: "gcsPath is required" });

    try {
      const bucket = gcs.bucket(bucketName);
      
      // Delete the main file
      await bucket.file(gcsPath).delete({ ignoreNotFound: true });
      
      // Delete the preview file
      // gcsPath is "arquivos-matrizes/123-file.pes"
      // preview is "imagens-vitrine/123-file.png"
      const fileName = path.parse(gcsPath).name;
      const previewPath = `imagens-vitrine/${fileName}.png`;
      await bucket.file(previewPath).delete({ ignoreNotFound: true });

      res.json({ success: true, message: "Files deleted successfully" });
    } catch (error: any) {
      console.error("Delete Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/upload-embroidery", upload.single("file"), async (req, res) => {
    const gcs = getStorage();
    if (!gcs) {
      const hasVar = !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
      const errorMsg = hasVar 
        ? "GCS not configured: O JSON das credenciais é inválido (deve começar com { ). Verifique os Secrets."
        : "GCS not configured: A variável GOOGLE_APPLICATION_CREDENTIALS_JSON não foi encontrada nos Secrets.";
      
      return res.status(500).json({ 
        error: errorMsg,
        setupGuide: "https://console.cloud.google.com/iam-admin/serviceaccounts"
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    try {
      const bucket = gcs.bucket(bucketName);
      const fileName = `arquivos-matrizes/${Date.now()}-${req.file.originalname}`;
      const blob = bucket.file(fileName);
      const blobStream = blob.createWriteStream({
        resumable: false,
        contentType: req.file.mimetype,
      });

      blobStream.on("error", (err) => {
        console.error("GCS Upload Error:", err);
        res.status(500).json({ error: err.message });
      });

      blobStream.on("finish", () => {
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
        
        // The Cloud Function uses the basename of the uploaded file
        // fileName is "arquivos-matrizes/123-file.pes"
        // path.parse(fileName).name will be "123-file"
        const uploadedBaseName = path.parse(fileName).name;
        const previewUrl = `https://storage.googleapis.com/${bucketName}/imagens-vitrine/${uploadedBaseName}.png`;
        
        res.json({ 
          success: true, 
          fileName: req.file!.originalname,
          gcsPath: fileName,
          publicUrl,
          previewUrl
        });
      });

      blobStream.end(req.file.buffer);
    } catch (error: any) {
      console.error("Upload Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Global Server Error:", err);
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  });
}

startServer();
