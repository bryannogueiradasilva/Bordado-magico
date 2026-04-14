import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { Storage } from "@google-cloud/storage";
import admin from "firebase-admin";
import multer from "multer";
import dotenv from "dotenv";
import cors from "cors";

// Carrega variáveis de ambiente do arquivo .env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * CONFIGURAÇÃO DO BACKEND (EXPRESS)
 * 
 * Este arquivo isola toda a lógica de API do frontend.
 * Objetivo: Estabilidade e facilidade de deploy no Cloud Run.
 */

async function startServer() {
  const app = express();
  
  // O Cloud Run injeta a porta automaticamente, ou usamos 3000 por padrão
  const PORT = Number(process.env.PORT) || 3000;

  // Middlewares básicos para processamento de JSON e formulários
  app.use(cors({ origin: '*' }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Configuração do Google Cloud Storage (GCS)
  const bucketName = process.env.GCS_BUCKET_NAME || "appbordados";

  /**
   * Helper para obter credenciais.
   * Se estiver no Cloud Run, ele usa a Service Account automática (ADC).
   * Se houver a variável GOOGLE_APPLICATION_CREDENTIALS_JSON, usamos ela (útil para dev local).
   */
  function getCredentials() {
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (credentialsJson && credentialsJson.trim().startsWith('{')) {
      try {
        return JSON.parse(credentialsJson);
      } catch (e) {
        console.error("❌ Erro ao parsear GOOGLE_APPLICATION_CREDENTIALS_JSON:", e);
      }
    }
    return null;
  }

  function getStorage() {
    const creds = getCredentials();
    // Se não houver credenciais manuais, o SDK tenta usar o ambiente (Cloud Run)
    return creds ? new Storage({ credentials: creds }) : new Storage();
  }

  function getFirebaseAdmin() {
    if (admin.apps.length > 0) return admin.app('admin-app');
    const creds = getCredentials();
    const options: admin.AppOptions = { databaseURL: process.env.FIREBASE_DATABASE_URL };
    if (creds) options.credential = admin.credential.cert(creds);
    return admin.initializeApp(options, 'admin-app');
  }

  // Configuração do Multer para upload de arquivos em memória
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // Limite de 50MB
  });

  // ==========================================
  // ROTAS DE API (/api/*)
  // Devem vir SEMPRE antes do fallback do SPA
  // ==========================================

  // Status da configuração do GCS
  app.get("/api/gcs-status", (req: Request, res: Response) => {
    const hasJson = !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    return res.json({
      configured: hasJson || !!process.env.K_SERVICE, // K_SERVICE indica que estamos no Cloud Run
      bucket: bucketName,
      environment: process.env.K_SERVICE ? 'production' : 'development'
    });
  });

  // Listagem de matrizes no bucket
  app.get("/api/list-embroidery", async (req: Request, res: Response) => {
    console.log("📂 Listando arquivos no bucket:", bucketName);
    try {
      const gcs = getStorage();
      const [files] = await gcs.bucket(bucketName).getFiles({ prefix: "arquivos-matrizes/" });
      const fileNames = files
        .map(file => file.name)
        .filter(name => name !== "arquivos-matrizes/");
      
      return res.json({ files: fileNames });
    } catch (error: any) {
      console.error("❌ Erro ao listar arquivos:", error.message);
      return res.status(500).json({ error: "Falha ao listar arquivos no bucket" });
    }
  });

  // Upload de nova matriz
  app.post("/api/upload-embroidery", upload.single("file"), async (req: Request, res: Response) => {
    console.log("🚀 Iniciando upload de arquivo...");
    console.log("📦 FILE COMPLETO:", req.file);

    if (req.file) {
      console.log("📁 NOME:", req.file.originalname);
      console.log("📏 SIZE:", req.file.size);
      console.log("📎 MIME:", req.file.mimetype);
    }

    if (!req.file) {
      console.error("❌ Erro: Nenhum arquivo recebido no req.file");
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    try {
      const gcs = getStorage();
      const fileName = `arquivos-matrizes/${Date.now()}-${req.file.originalname}`;
      const blob = gcs.bucket(bucketName).file(fileName);
      
      console.log(`📤 Fazendo upload para: ${fileName}`);

      const stream = blob.createWriteStream({ 
        resumable: false, 
        contentType: req.file.mimetype 
      });

      stream.on("error", (err) => {
        console.error("❌ Erro no stream de upload GCS:", err);
        return res.status(500).json({ 
          error: "Erro ao gravar arquivo no Google Cloud Storage",
          details: err.message,
          bucket: bucketName
        });
      });

      stream.on("finish", () => {
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
        const baseName = path.parse(fileName).name;
        const previewUrl = `https://storage.googleapis.com/${bucketName}/imagens-vitrine/${baseName}.png`;

        console.log("✅ Upload concluído com sucesso!");
        return res.json({
          success: true,
          gcsPath: fileName,
          publicUrl,
          previewUrl
        });
      });

      stream.end(req.file.buffer);
    } catch (error: any) {
      console.error("❌ Erro fatal no upload:", error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  // Deleção de matriz e sua imagem de vitrine
  app.delete("/api/delete-embroidery", async (req: Request, res: Response) => {
    const { gcsPath } = req.body;
    console.log(`🗑️ Solicitando deleção: ${gcsPath}`);

    if (!gcsPath) {
      return res.status(400).json({ error: "Caminho do arquivo (gcsPath) é obrigatório" });
    }

    try {
      const gcs = getStorage();
      const bucketObj = gcs.bucket(bucketName);
      
      // Deleta o arquivo da matriz
      await bucketObj.file(gcsPath).delete({ ignoreNotFound: true });

      // Tenta deletar a imagem de vitrine correspondente
      const fileName = path.parse(gcsPath).name;
      const previewPath = `imagens-vitrine/${fileName}.png`;
      await bucketObj.file(previewPath).delete({ ignoreNotFound: true });

      console.log("✅ Arquivo e preview deletados.");
      return res.json({ success: true });
    } catch (error: any) {
      console.error("❌ Erro ao deletar arquivo:", error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  // Admin: Listar usuários do Firebase
  app.get("/api/admin/users", async (req: Request, res: Response) => {
    try {
      const adminApp = getFirebaseAdmin();
      const users = await adminApp.auth().listUsers();
      return res.json({ users: users.users });
    } catch (error: any) {
      console.error("❌ Erro ao listar usuários:", error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  // Admin: Deletar usuário do Firebase
  app.delete("/api/admin/users/:uid", async (req: Request, res: Response) => {
    try {
      const adminApp = getFirebaseAdmin();
      await adminApp.auth().deleteUser(req.params.uid);
      return res.json({ success: true });
    } catch (error: any) {
      console.error("❌ Erro ao deletar usuário:", error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  /**
   * SINCRONIZAÇÃO AUTOMÁTICA: GCS <-> FIREBASE
   * Remove do Firebase as matrizes que não existem mais no GCS.
   */
  app.post("/api/sync-gcs-firebase", async (req: Request, res: Response) => {
    console.log("🔄 Iniciando sincronização GCS -> Firebase...");
    try {
      const gcs = getStorage();
      const adminApp = getFirebaseAdmin();
      const dbAdmin = adminApp.database();

      // 1. Lista arquivos no GCS
      const [files] = await gcs.bucket(bucketName).getFiles({ prefix: "arquivos-matrizes/" });
      const gcsFiles = new Set(files.map(f => f.name));

      // 2. Busca produtos no Firebase
      const snapshot = await dbAdmin.ref('products').get();
      if (!snapshot.exists()) {
        return res.json({ success: true, message: "Nenhum produto para sincronizar." });
      }

      const products: any[] = snapshot.val();
      const productsArray = Array.isArray(products) ? products : Object.values(products);

      // 3. Filtra produtos: Mantém apenas os que existem no GCS (ou que não dependem do GCS)
      const validProducts = productsArray.filter(p => {
        // Se não tem gcsPath, mantemos (pode ser mock ou link externo)
        if (!p.gcsPath) return true;
        // Se tem gcsPath, verificamos se o arquivo existe no GCS
        return gcsFiles.has(p.gcsPath);
      });

      const removedCount = productsArray.length - validProducts.length;

      if (removedCount > 0) {
        console.log(`🧹 Removendo ${removedCount} produtos órfãos do Firebase.`);
        await dbAdmin.ref('products').set(validProducts);
      } else {
        console.log("✅ Tudo sincronizado. Nenhum produto órfão encontrado.");
      }

      return res.json({ 
        success: true, 
        removedCount, 
        totalCount: validProducts.length 
      });
    } catch (error: any) {
      console.error("❌ Erro na sincronização:", error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // FRONTEND (VITE / STATIC FILES)
  // Deve vir SEMPRE DEPOIS das rotas de API
  // ==========================================

  if (process.env.NODE_ENV !== "production") {
    // Em desenvolvimento, usamos o middleware do Vite
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("🛠️ Vite middleware carregado (Modo Desenvolvimento)");
  } else {
    // Em produção, servimos os arquivos estáticos da pasta /dist
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    
    // Fallback para SPA (Single Page Application)
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("📦 Servindo arquivos estáticos de /dist (Modo Produção)");
  }

  // Inicia o servidor
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Servidor backend rodando em http://0.0.0.0:${PORT}`);
  });
}

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer().catch(err => {
  console.error("💥 Falha crítica ao iniciar o servidor:", err);
});
