import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  barcode: text("barcode").unique(),
  stock: integer("stock").notNull().default(0),
  cost: integer("cost").notNull(),
  price: integer("price").notNull(),
  minStock: integer("min_stock").notNull().default(300),
  unit: text("unit").notNull().default("unidad"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const movements = sqliteTable("movements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull(),
  type: text("type", { enum: ["initial", "entry", "output"] }).notNull(),
  quantity: integer("quantity").notNull(),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  lot: text("lot"),
  expirationDate: text("expiration_date"),
  note: text("note"),
  source: text("source", { enum: ["manual", "scanner"] }).notNull().default("manual"),
  reference: text("reference").unique(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// v2 uses fresh authentication tables. The first public deployment created the
// original tables before the complete credential columns were available, so
// keeping authentication isolated here lets us repair access without touching
// products, stock, or movement history.
export const appUsers = sqliteTable("app_users_v2", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").unique(),
  username: text("username").unique(),
  passwordHash: text("password_hash"),
  passwordSalt: text("password_salt"),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(true),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: text("locked_until"),
  lastLoginAt: text("last_login_at"),
  role: text("role", {
    enum: ["owner", "admin", "warehouse", "dispatch", "viewer"],
  }).notNull(),
  canViewCost: integer("can_view_cost", { mode: "boolean" }).notNull().default(false),
  canManageUsers: integer("can_manage_users", { mode: "boolean" }).notNull().default(false),
  active: integer("active", { mode: "boolean" }).notNull().default(false),
  systemAccount: integer("system_account", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const appSessions = sqliteTable("app_sessions_v2", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
