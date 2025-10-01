import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";

// Tooth configuration schema
export const toothConfigurationSchema = z.object({
  toothNumber: z.string(),
  toothName: z.string(),
  workType: z.enum(["com_prova", "sem_prova"]).optional(),
  material: z.enum(["zirconia", "pmma", "dissilicato"]).optional(),
  color: z.enum(["A1", "A2", "A3", "BL1", "BL2", "BL3", "BL4"]).optional(),
  workCategory: z.enum(["faceta", "onlay", "sob_implante", "sob_dente", "placa_mio"]).optional(),
  implantType: z.enum([
    "pilar_gt", 
    "munhao_universal_33x6", 
    "munhao_universal_33x4", 
    "he_41", 
    "mini_pilar_sirona"
  ]).optional(),
  fixationType: z.enum(["unitaria", "protocolo"]).optional(),
  isFixed: z.boolean().default(false),
  connectedTeeth: z.string().optional(),
  mirrorTooth: z.boolean().default(false),
  standardLibrary: z.boolean().default(false),
  toothShape: z.enum(["redondo", "quadrado", "pontudo"]).optional(),
  articulator: z.boolean().default(false),
  articulatorMM: z.number().optional(),
});

// Main dental order schema
export const dentalOrderSchema = z.object({
  patientName: z.string().min(1, "Nome do paciente é obrigatório"),
  patientId: z.string().optional(),
  selectedTeeth: z.array(z.object({
    number: z.string(),
    name: z.string(),
    id: z.string(),
  })),
  toothConfigurations: z.record(z.string(), toothConfigurationSchema),
  observations: z.string().optional(),
  timestamp: z.string(),
});

export type ToothConfiguration = z.infer<typeof toothConfigurationSchema>;
export type DentalOrder = z.infer<typeof dentalOrderSchema>;

// Insert schemas
export const insertDentalOrderSchema = dentalOrderSchema.omit({
  timestamp: true,
});

export type InsertDentalOrder = z.infer<typeof insertDentalOrderSchema>;
