import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users, type InsertUser, type User } from "@shared/db-schema";
import { eq } from "drizzle-orm";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createUser(insertUser: InsertUser): Promise<User> {
  const hashedPassword = await hashPassword(insertUser.password);
  const [user] = await db
    .insert(users)
    .values({ ...insertUser, password: hashedPassword })
    .returning();
  return user;
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return user;
}

export async function getUserById(id: number): Promise<User | undefined> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user;
}

export async function verifyLogin(username: string, password: string): Promise<User | null> {
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

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}
