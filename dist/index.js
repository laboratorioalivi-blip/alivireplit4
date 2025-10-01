var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express3 from "express";

// server/routes.ts
import express from "express";
import { createServer } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool as Pool2 } from "pg";

// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// shared/db-schema.ts
var db_schema_exports = {};
__export(db_schema_exports, {
  dentalOrders: () => dentalOrders,
  insertDentalOrderSchema: () => insertDentalOrderSchema,
  insertUserSchema: () => insertUserSchema,
  selectDentalOrderSchema: () => selectDentalOrderSchema,
  selectUserSchema: () => selectUserSchema,
  users: () => users
});
import { pgTable, text, timestamp, serial, jsonb, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  fullName: varchar("full_name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var dentalOrders = pgTable("dental_orders", {
  id: serial("id").primaryKey(),
  orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),
  patientName: varchar("patient_name", { length: 255 }).notNull(),
  patientId: varchar("patient_id", { length: 100 }),
  selectedTeeth: jsonb("selected_teeth").notNull().$type(),
  toothConfigurations: jsonb("tooth_configurations").notNull().$type(),
  observations: text("observations"),
  smilePhotoPath: varchar("smile_photo_path", { length: 500 }),
  scannerFilePath: varchar("scanner_file_path", { length: 500 }),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var insertUserSchema = createInsertSchema(users, {
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email().optional()
});
var selectUserSchema = createSelectSchema(users);
var insertDentalOrderSchema = createInsertSchema(dentalOrders, {
  patientName: z.string().min(1, "Patient name is required"),
  selectedTeeth: z.array(z.object({
    number: z.string(),
    name: z.string(),
    id: z.string()
  })).min(1, "At least one tooth must be selected"),
  toothConfigurations: z.record(z.string(), z.any()),
  smilePhotoPath: z.string().optional(),
  scannerFilePath: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).default("pending")
}).omit({ id: true, orderNumber: true, createdAt: true, updatedAt: true });
var selectDentalOrderSchema = createSelectSchema(dentalOrders);

// server/db.ts
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}
var pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
var db = drizzle(pool, { schema: db_schema_exports });

// server/auth.ts
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}
async function createUser(insertUser) {
  const hashedPassword = await hashPassword(insertUser.password);
  const [user] = await db.insert(users).values({ ...insertUser, password: hashedPassword }).returning();
  return user;
}
async function getUserByUsername(username) {
  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return user;
}
async function getUserById(id) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user;
}
async function verifyLogin(username, password) {
  const user = await getUserByUsername(username);
  if (!user) {
    return null;
  }
  const isValid = await comparePassword(password, user.password);
  if (!isValid) {
    return null;
  }
  return user;
}
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

// server/routes.ts
import { eq as eq2, desc, sql, and } from "drizzle-orm";
import { z as z2 } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
var PgSession = connectPgSimple(session);
var storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = file.fieldname === "smilePhoto" ? "uploads/smile-photos" : "uploads/scanner-files";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
var upload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024
    // 200MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "smilePhoto") {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("Apenas imagens s\xE3o permitidas para foto do sorriso"));
      }
    } else if (file.fieldname === "scannerFile") {
      const allowedExtensions = [".stl", ".obj", ".ply", ".zip"];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowedExtensions.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error("Apenas arquivos STL, OBJ, PLY ou ZIP s\xE3o permitidos"));
      }
    } else {
      cb(null, true);
    }
  }
});
async function registerRoutes(app2) {
  const sessionStore = new PgSession({
    pool: new Pool2({ connectionString: process.env.DATABASE_URL }),
    tableName: "session",
    createTableIfMissing: true
  });
  if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is required in production");
  }
  app2.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || "dental-lab-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "strict",
        maxAge: 1e3 * 60 * 60 * 24 * 7
        // 7 days
      }
    })
  );
  app2.post("/api/auth/register", async (req, res) => {
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
        fullName: user.fullName
      });
    } catch (error) {
      console.error("Error creating user:", error);
      if (error.code === "23505") {
        return res.status(400).json({ message: "Username already exists" });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });
  app2.post("/api/auth/login", async (req, res) => {
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
        fullName: user.fullName
      });
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });
  app2.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });
  app2.get("/api/auth/me", async (req, res) => {
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
      fullName: user.fullName
    });
  });
  const handleMulterError = (err, req, res, next) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ success: false, error: "Arquivo muito grande. Tamanho m\xE1ximo: 50MB" });
      }
      if (err.message === "Invalid file type") {
        return res.status(400).json({ success: false, error: "Tipo de arquivo inv\xE1lido" });
      }
      return res.status(400).json({ success: false, error: err.message || "Erro ao processar arquivo" });
    }
    next();
  };
  app2.post("/api/upload/smile-photo", requireAuth, upload.single("smilePhoto"), handleMulterError, (req, res) => {
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
  app2.post("/api/upload/scanner-file", requireAuth, upload.single("scannerFile"), handleMulterError, (req, res) => {
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
  app2.use("/uploads", requireAuth, express.static("uploads"));
  app2.post("/api/dental-orders", async (req, res) => {
    try {
      const validatedData = insertDentalOrderSchema.parse(req.body);
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const [dentalOrder] = await db.insert(dentalOrders).values({
        ...validatedData,
        orderNumber,
        status: "pending"
      }).returning();
      res.json({ success: true, order: dentalOrder });
    } catch (error) {
      if (error instanceof z2.ZodError) {
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
  app2.get("/api/dental-orders", async (req, res) => {
    try {
      const { status, search, limit = "50", offset = "0" } = req.query;
      let query = db.select().from(dentalOrders);
      const conditions = [];
      if (status && typeof status === "string") {
        conditions.push(eq2(dentalOrders.status, status));
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
        query = query.where(and(...conditions));
      }
      const orders = await query.orderBy(desc(dentalOrders.createdAt)).limit(parseInt(limit)).offset(parseInt(offset));
      const [{ count }] = await db.select({ count: sql`count(*)` }).from(dentalOrders);
      res.json({
        success: true,
        orders,
        total: Number(count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } catch (error) {
      console.error("Error fetching dental orders:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch dental orders"
      });
    }
  });
  app2.get("/api/dental-orders/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [order] = await db.select().from(dentalOrders).where(eq2(dentalOrders.id, id)).limit(1);
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
  app2.patch("/api/dental-orders/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      if (!["pending", "in_progress", "completed", "cancelled"].includes(status)) {
        return res.status(400).json({
          success: false,
          error: "Invalid status"
        });
      }
      const [updatedOrder] = await db.update(dentalOrders).set({
        status,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(dentalOrders.id, id)).returning();
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
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express2 from "express";
import fs2 from "fs";
import path3 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path2 from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path2.resolve(import.meta.dirname, "client", "src"),
      "@shared": path2.resolve(import.meta.dirname, "shared"),
      "@assets": path2.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path2.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path2.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.PORT) || 5e3,
    strictPort: true,
    allowedHosts: true,
    hmr: {
      clientPort: 443,
      protocol: "wss"
    },
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  },
  preview: {
    host: "0.0.0.0",
    port: Number(process.env.PORT) || 5e3
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path3.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path3.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express2.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path3.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express3();
app.use(express3.json());
app.use(express3.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path4 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path4.startsWith("/api")) {
      let logLine = `${req.method} ${path4} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
async function initializeAdminUser() {
  try {
    const existingAdmin = await getUserByUsername("admin");
    if (!existingAdmin) {
      await createUser({
        username: "admin",
        password: "admin123",
        email: "admin@dentallab.com",
        fullName: "Administrator"
      });
      log("Admin user created successfully");
    } else {
      log("Admin user already exists");
    }
  } catch (error) {
    console.error("Error initializing admin user:", error?.message || error);
  }
}
(async () => {
  await initializeAdminUser();
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
