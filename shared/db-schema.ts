import { pgTable, text, timestamp, serial, jsonb, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  fullName: varchar("full_name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dentalOrders = pgTable("dental_orders", {
  id: serial("id").primaryKey(),
  orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),
  patientName: varchar("patient_name", { length: 255 }).notNull(),
  patientId: varchar("patient_id", { length: 100 }),
  selectedTeeth: jsonb("selected_teeth").notNull().$type<Array<{ number: string; name: string; id: string }>>(),
  toothConfigurations: jsonb("tooth_configurations").notNull().$type<Record<string, any>>(),
  observations: text("observations"),
  smilePhotoPath: varchar("smile_photo_path", { length: 500 }),
  scannerFilePath: varchar("scanner_file_path", { length: 500 }),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Schemas for Zod validation
export const insertUserSchema = createInsertSchema(users, {
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email().optional(),
});

export const selectUserSchema = createSelectSchema(users);

export const insertDentalOrderSchema = createInsertSchema(dentalOrders, {
  patientName: z.string().min(1, "Patient name is required"),
  selectedTeeth: z.array(z.object({
    number: z.string(),
    name: z.string(),
    id: z.string(),
  })).min(1, "At least one tooth must be selected"),
  toothConfigurations: z.record(z.string(), z.any()),
  smilePhotoPath: z.string().optional(),
  scannerFilePath: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).default("pending"),
}).omit({ id: true, orderNumber: true, createdAt: true, updatedAt: true });

export const selectDentalOrderSchema = createSelectSchema(dentalOrders);

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type DentalOrder = typeof dentalOrders.$inferSelect;
export type InsertDentalOrder = z.infer<typeof insertDentalOrderSchema>;
