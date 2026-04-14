import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { Storage } from "@google-cloud/storage";
import admin from "firebase-admin";
import multer from "multer";
import dotenv from "dotenv";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Carrega variáveis de ambiente do arquivo .env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicializa Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function analyzeImageWithAI(base64Image: string, mimeType: string) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = "Analise essa imagem de bordado e responda exatamente neste formato:\nNome: ...\nCategoria: ...\nDescrição: ... (persuasiva para bordadeiras)";
    
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType
        }
      }
    ]);
    
    const text = result.response.text();
    console.log("🤖 IA Resposta:", text);
    
    return {
      name: text.match(/Nome:\s*(.*)/i)?.[1]?.trim(),
      category: text.match(/Categoria:\s*(.*)/i)?.[1]?.trim(),
      description: text.match(/Descrição:\s*([\s\S]*)/i)?.[1]?.trim()
    };
  } catch (error) {
    console.error("❌ Erro na análise da IA:", error);
    return null;
  }
}

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
  app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Content-Type"]
  }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Configuração do Google Cloud Storage (GCS)
  const bucketName = process.env.GCS_BUCKET_NAME || "appbordados";

  function getStorage() {
    return new Storage();
  }

  function getFirebaseAdmin() {
    if (admin.apps.length > 0) return admin.app();

    return admin.initializeApp({
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  }

  console.log("🔥 Firebase Admin inicializado");
  console.log("🔥 Google Cloud Storage inicializado");

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
    return res.json({
      configured: true, // Agora assumimos que o ambiente (Cloud Run) está configurado via IAM
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

  // Upload de nova matriz com análise de IA
  app.post("/api/upload-embroidery", upload.fields([{ name: 'file', maxCount: 1 }, { name: 'image', maxCount: 1 }]), async (req: Request, res: Response) => {
    console.log("🚀 Iniciando upload inteligente...");
    
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const matrixFile = files?.['file']?.[0];
    const imageFile = files?.['image']?.[0];

    if (!matrixFile) {
      return res.status(400).json({ error: "Arquivo de matriz (.pes, .dst, etc) é obrigatório" });
    }

    try {
      const gcs = getStorage();
      const bucket = gcs.bucket(bucketName);
      
      // 1. Verificar se arquivo já existe (Duplicação exata de caminho)
      const existingFileName = `arquivos-matrizes/${matrixFile.originalname}`;
      const [exists] = await bucket.file(existingFileName).exists();
      
      if (exists) {
        console.log("⚠️ Arquivo já existe no GCS.");
        return res.json({ error: "Arquivo já existe" });
      }

      let aiData = null;
      try {
        if (imageFile) {
          console.log("🤖 Analisando imagem com IA...");
          const base64 = imageFile.buffer.toString('base64');
          aiData = await analyzeImageWithAI(base64, imageFile.mimetype);
        }
      } catch (err) {
        console.error("❌ Erro IA:", err);
      }

      if (!aiData || !aiData.name) {
        console.warn("⚠️ IA falhou ou não retornou dados. Usando fallback seguro.");
        const baseName = path.parse(matrixFile.originalname).name.replace(/[-_]/g, ' ');
        aiData = {
          name: baseName || "design bordado",
          category: "Geral",
          description: `✨ Matriz de bordado "${baseName || 'de alta qualidade'}" pronta para uso.`
        };
      }

      // 2. Upload da Matriz
      const blob = bucket.file(existingFileName);
      const stream = blob.createWriteStream({ 
        resumable: false, 
        contentType: matrixFile.mimetype 
      });

      stream.on("error", (err) => {
        console.error("❌ Erro no stream de upload GCS:", err);
        return res.status(500).json({ error: "Erro ao gravar arquivo no GCS" });
      });

      stream.on("finish", async () => {
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${existingFileName}`;
        const baseName = path.parse(existingFileName).name;
        const previewUrl = `https://storage.googleapis.com/${bucketName}/imagens-vitrine/${baseName}.png`;

        console.log("✅ Upload concluído com sucesso!");

        // 3. Salvar metadados no Firebase Realtime Database
        // Garantir nome único no banco de dados
        const adminApp = getFirebaseAdmin();
        const db = adminApp.database();
        const productsRef = db.ref('products');
        
        const snapshot = await productsRef.get();
        let existingNames: string[] = [];
        if (snapshot.exists()) {
          const products = Object.values(snapshot.val() as Record<string, any>);
          existingNames = products.map(p => p.name);
        }

        let uniqueName = aiData!.name!;
        let count = 1;
        while (existingNames.includes(uniqueName)) {
          uniqueName = `${aiData!.name} ${count}`;
          count++;
        }

        const finalMetadata = {
          name: uniqueName,
          category: aiData!.category || "Geral",
          description: aiData!.description || `✨ Matriz de bordado "${uniqueName}" perfeita para seus projetos!`,
          fileUrl: publicUrl,
          imageUrl: previewUrl,
          fileName: matrixFile.originalname,
          gcsPath: existingFileName,
          createdAt: Date.now(),
          price: 19.90,
          soldCount: 0,
          reviews: []
        };

        const newProductRef = productsRef.push();
        const finalProduct = {
          id: newProductRef.key,
          ...finalMetadata
        };

        try {
          await newProductRef.set(finalProduct);
          console.log("✅ Metadados salvos no Firebase RTDB");
        } catch (dbError) {
          console.error("❌ Erro ao salvar metadados no Firebase:", dbError);
        }

        console.log("✅ UPLOAD OK:", finalProduct);

        return res.json({
          success: true,
          file: finalProduct,
          gcsPath: existingFileName,
          publicUrl,
          previewUrl,
          aiData: { ...aiData, name: uniqueName },
          isDuplicate: false
        });
      });

      stream.end(matrixFile.buffer);
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

  // Admin: Atualizar usuário do Firebase
  app.patch("/api/admin/users/:uid", async (req: Request, res: Response) => {
    const { uid } = req.params;
    const { email, password, displayName } = req.body;
    try {
      const adminApp = getFirebaseAdmin();
      await adminApp.auth().updateUser(uid, {
        email,
        password: password || undefined,
        displayName
      });
      return res.json({ success: true });
    } catch (error: any) {
      console.error("❌ Erro ao atualizar usuário:", error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // SISTEMA DE PRESENÇA (IN-MEMORY)
  // ==========================================
  const userPresence = new Map<string, number>();

  // Atualizar presença (Heartbeat)
  app.post("/api/presence/update", (req: Request, res: Response) => {
    const { uid, lastSeen } = req.body;
    if (uid) {
      userPresence.set(uid, lastSeen || Date.now());
    }
    return res.json({ success: true });
  });

  // Marcar como offline
  app.post("/api/presence/offline", (req: Request, res: Response) => {
    const { uid } = req.body;
    if (uid) {
      userPresence.delete(uid);
    }
    return res.json({ success: true });
  });

  // Listar usuários online
  app.get("/api/presence/list", (req: Request, res: Response) => {
    const list = Array.from(userPresence.entries()).map(([uid, lastSeen]) => ({
      uid,
      lastSeen
    }));
    return res.json({ presence: list });
  });

  // ==========================================
  // SISTEMA DE COMPRAS E ACESSO (MY FILES)
  // ==========================================
  
  // Registrar compra / vínculo de arquivo
  app.post("/api/purchase", async (req: Request, res: Response) => {
    const { userId, fileId } = req.body;
    if (!userId || !fileId) {
      return res.status(400).json({ error: "userId e fileId são obrigatórios" });
    }

    try {
      const adminApp = getFirebaseAdmin();
      const dbAdmin = adminApp.database();
      
      const purchaseId = `${userId}_${fileId}`;
      await dbAdmin.ref(`purchases/${purchaseId}`).set({
        userId,
        fileId,
        createdAt: Date.now()
      });

      return res.json({ success: true });
    } catch (error: any) {
      console.error("❌ Erro ao registrar compra:", error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  // Listar arquivos do usuário (Minhas Matrizes)
  app.get("/api/my-files/:uid", async (req: Request, res: Response) => {
    const { uid } = req.params;
    try {
      const adminApp = getFirebaseAdmin();
      const dbAdmin = adminApp.database();

      // 1. Busca compras do usuário
      const purchasesSnapshot = await dbAdmin.ref('purchases')
        .orderByChild('userId')
        .equalTo(uid)
        .get();

      if (!purchasesSnapshot.exists()) {
        return res.json({ files: [] });
      }

      const purchases = Object.values(purchasesSnapshot.val() as Record<string, any>);
      const fileIds = purchases.map(p => p.fileId);

      // 2. Busca os detalhes dos produtos
      const productsSnapshot = await dbAdmin.ref('products').get();
      if (!productsSnapshot.exists()) {
        return res.json({ files: [] });
      }

      const allProducts: any[] = Object.values(productsSnapshot.val());
      const userFiles = allProducts.filter(p => fileIds.includes(p.id));

      return res.json({ files: userFiles });
    } catch (error: any) {
      console.error("❌ Erro ao buscar arquivos do usuário:", error.message);
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
