import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import { db } from "./db";
import { dentalOrders, insertDentalOrderSchema } from "@shared/db-schema";
import { createUser, verifyLogin, requireAuth, getUserById } from "./auth";
import { eq, desc, sql, and, like } from "drizzle-orm";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";

const PgSession = connectPgSimple(session);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = file.fieldname === "smilePhoto" 
      ? "uploads/smile-photos" 
      : "uploads/scanner-files";
    
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "smilePhoto") {
      // Accept images only
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("Apenas imagens são permitidas para foto do sorriso"));
      }
    } else if (file.fieldname === "scannerFile") {
      // Accept STL and other 3D model files
      const allowedExtensions = [".stl", ".obj", ".ply", ".zip"];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowedExtensions.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error("Apenas arquivos STL, OBJ, PLY ou ZIP são permitidos"));
      }
    } else {
      cb(null, true);
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure session store
  const sessionStore = new PgSession({
    pool: new Pool({ connectionString: process.env.DATABASE_URL! }),
    tableName: "session",
    createTableIfMissing: true,
  });

  // Validate SESSION_SECRET in production
  if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is required in production");
  }

  app.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || "dental-lab-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "strict",
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      },
    })
  );

  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password, email, fullName } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const user = await createUser({ username, password, email, fullName });
      req.session.userId = user.id;
      
      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
      });
    } catch (error: any) {
      console.error("Error creating user:", error);
      if (error.code === "23505") { // Unique constraint violation
        return res.status(400).json({ message: "Username already exists" });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const user = await verifyLogin(username, password);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      req.session.userId = user.id;
      
      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
      });
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await getUserById(req.session.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
    });
  });

  // Multer error handler middleware
  const handleMulterError = (err: any, req: Request, res: Response, next: NextFunction) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: "Arquivo muito grande. Tamanho máximo: 50MB" });
      }
      if (err.message === 'Invalid file type') {
        return res.status(400).json({ success: false, error: "Tipo de arquivo inválido" });
      }
      return res.status(400).json({ success: false, error: err.message || "Erro ao processar arquivo" });
    }
    next();
  };

  // File upload routes (protected)
  app.post("/api/upload/smile-photo", requireAuth, upload.single("smilePhoto"), handleMulterError, (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "Nenhum arquivo foi enviado" });
      }
      
      res.json({ 
        success: true, 
        filePath: `/uploads/smile-photos/${req.file.filename}`,
        fileName: req.file.originalname
      });
    } catch (error) {
      console.error("Error uploading smile photo:", error);
      res.status(500).json({ success: false, error: "Erro ao fazer upload da foto" });
    }
  });

  app.post("/api/upload/scanner-file", requireAuth, upload.single("scannerFile"), handleMulterError, (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "Nenhum arquivo foi enviado" });
      }
      
      res.json({ 
        success: true, 
        filePath: `/uploads/scanner-files/${req.file.filename}`,
        fileName: req.file.originalname
      });
    } catch (error) {
      console.error("Error uploading scanner file:", error);
      res.status(500).json({ success: false, error: "Erro ao fazer upload do arquivo" });
    }
  });

  // Serve uploaded files (protected)
  app.use("/uploads", requireAuth, express.static("uploads"));

  // Dental order routes
  app.post("/api/dental-orders", async (req, res) => {
    try {
      const validatedData = insertDentalOrderSchema.parse(req.body);
      
      // Generate unique order number
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      const [dentalOrder] = await db
        .insert(dentalOrders)
        .values({
          ...validatedData,
          orderNumber,
          status: "pending",
        })
        .returning();
      
      res.json({ success: true, order: dentalOrder });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          error: error.errors[0].message 
        });
      }
      console.error("Error creating dental order:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to create dental order" 
      });
    }
  });

  app.get("/api/dental-orders", async (req, res) => {
    try {
      const { status, search, limit = "50", offset = "0" } = req.query;
      
      let query = db.select().from(dentalOrders);
      const conditions = [];

      if (status && typeof status === "string") {
        conditions.push(eq(dentalOrders.status, status));
      }

      if (search && typeof search === "string") {
        conditions.push(
          sql`(
            ${dentalOrders.orderNumber} ILIKE ${`%${search}%`} OR
            ${dentalOrders.patientName} ILIKE ${`%${search}%`} OR
            ${dentalOrders.patientId} ILIKE ${`%${search}%`}
          )`
        );
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const orders = await query
        .orderBy(desc(dentalOrders.createdAt))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));

      // Get total count
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(dentalOrders);

      res.json({ 
        success: true, 
        orders,
        total: Number(count),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });
    } catch (error) {
      console.error("Error fetching dental orders:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to fetch dental orders" 
      });
    }
  });

  app.get("/api/dental-orders/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const [order] = await db
        .select()
        .from(dentalOrders)
        .where(eq(dentalOrders.id, id))
        .limit(1);

      if (!order) {
        return res.status(404).json({ 
          success: false, 
          error: "Order not found" 
        });
      }

      res.json({ success: true, order });
    } catch (error) {
      console.error("Error fetching dental order:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to fetch dental order" 
      });
    }
  });

  app.patch("/api/dental-orders/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;

      if (!["pending", "in_progress", "completed", "cancelled"].includes(status)) {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid status" 
        });
      }

      const [updatedOrder] = await db
        .update(dentalOrders)
        .set({ 
          status, 
          updatedAt: new Date(),
        })
        .where(eq(dentalOrders.id, id))
        .returning();

      if (!updatedOrder) {
        return res.status(404).json({ 
          success: false, 
          error: "Order not found" 
        });
      }

      res.json({ success: true, order: updatedOrder });
    } catch (error) {
      console.error("Error updating dental order status:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to update order status" 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
