import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query, queryOne, execute } from "../db";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_EXPIRES_IN = "8h";
const SALT_ROUNDS = 12;

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "reviewer" | "viewer";
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export async function createAdminUser(
  email: string,
  password: string,
  name: string,
  role: "admin" | "reviewer" | "viewer" = "reviewer"
): Promise<AdminUser> {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const rows = await query<AdminUser>(
    `INSERT INTO admin_users (email, password_hash, name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, role, is_active, last_login, created_at`,
    [email, passwordHash, name, role]
  );

  return rows[0];
}

export async function authenticateAdmin(
  email: string,
  password: string
): Promise<{ user: AdminUser; token: string } | null> {
  const user = await queryOne<AdminUser & { password_hash: string }>(
    "SELECT * FROM admin_users WHERE email = $1 AND is_active = true",
    [email]
  );

  if (!user) return null;

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) return null;

  await execute("UPDATE admin_users SET last_login = NOW() WHERE id = $1", [
    user.id,
  ]);

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role } as JWTPayload,
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  const { password_hash: _, ...safeUser } = user;
  return { user: safeUser, token };
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export async function getAdminById(id: string): Promise<AdminUser | null> {
  return queryOne<AdminUser>(
    `SELECT id, email, name, role, is_active, last_login, created_at
     FROM admin_users WHERE id = $1`,
    [id]
  );
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  return query<AdminUser>(
    `SELECT id, email, name, role, is_active, last_login, created_at
     FROM admin_users ORDER BY created_at DESC`
  );
}

export async function updateAdminPassword(
  id: string,
  newPassword: string
): Promise<boolean> {
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const count = await execute(
    "UPDATE admin_users SET password_hash = $1 WHERE id = $2",
    [passwordHash, id]
  );
  return count > 0;
}

export async function deactivateAdmin(id: string): Promise<boolean> {
  const count = await execute(
    "UPDATE admin_users SET is_active = false WHERE id = $1",
    [id]
  );
  return count > 0;
}
