import { cookies } from "next/headers";
import type { AppUserRow } from "../db/mappers";
import { databaseError, getSupabaseAdmin } from "../db/supabase";

export type AppRole = "owner" | "admin" | "warehouse" | "dispatch" | "viewer";

export type AppUserProfile = {
  id: number;
  name: string;
  username: string | null;
  role: AppRole;
  canViewCost: boolean;
  canManageUsers: boolean;
  active: boolean;
  systemAccount: boolean;
  mustChangePassword: boolean;
};

const BOOTSTRAP_USERS = [
  { id: 101, name: "Bodega", username: "bodega", passwordEnv: "LINADIGEST_PASSWORD_BODEGA", role: "warehouse" as const, canViewCost: false, canManageUsers: false },
  { id: 102, name: "Despacho", username: "despacho", passwordEnv: "LINADIGEST_PASSWORD_DESPACHO", role: "dispatch" as const, canViewCost: false, canManageUsers: false },
  { id: 103, name: "Miguel Angel", username: "miguel", passwordEnv: "LINADIGEST_PASSWORD_MIGUEL", role: "admin" as const, canViewCost: true, canManageUsers: true },
  { id: 104, name: "Daniela Vasquez", username: "daniela", passwordEnv: "LINADIGEST_PASSWORD_DANIELA", role: "admin" as const, canViewCost: true, canManageUsers: true },
];

const SESSION_COOKIE = "linadigest_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_ITERATIONS = 100_000;

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

export async function hashPassword(password: string, suppliedSalt?: string) {
  const salt = suppliedSalt ? base64UrlToBytes(suppliedSalt) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PASSWORD_ITERATIONS },
    key,
    256,
  );
  return { hash: bytesToBase64Url(new Uint8Array(bits)), salt: bytesToBase64Url(salt) };
}

async function passwordMatches(password: string, expectedHash: string, salt: string) {
  const calculated = await hashPassword(password, salt);
  if (calculated.hash.length !== expectedHash.length) return false;
  let difference = 0;
  for (let index = 0; index < calculated.hash.length; index += 1) {
    difference |= calculated.hash.charCodeAt(index) ^ expectedHash.charCodeAt(index);
  }
  return difference === 0;
}

function toProfile(user: AppUserRow): AppUserProfile {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    canViewCost: user.can_view_cost,
    canManageUsers: user.can_manage_users,
    active: user.active,
    systemAccount: user.system_account,
    mustChangePassword: user.must_change_password,
  };
}

export async function ensureAppUsers() {
  const supabase = getSupabaseAdmin();
  for (const user of BOOTSTRAP_USERS) {
    const { error: insertError } = await supabase.from("app_users_v2").upsert({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      can_view_cost: user.canViewCost,
      can_manage_users: user.canManageUsers,
      active: true,
      system_account: false,
    }, { onConflict: "id", ignoreDuplicates: true });
    if (insertError) throw databaseError(insertError, "No fue posible preparar los usuarios");

    const { data, error } = await supabase.from("app_users_v2").select("*").eq("id", user.id).maybeSingle();
    if (error) throw databaseError(error, "No fue posible consultar los usuarios");
    const existing = data as AppUserRow | null;
    if (!existing) continue;

    const updates: Record<string, unknown> = {};
    if (!existing.username) updates.username = user.username;
    const temporaryPassword = String(process.env[user.passwordEnv] ?? "");
    if (temporaryPassword && (!existing.password_hash || !existing.password_salt || existing.must_change_password)) {
      const credentials = await hashPassword(temporaryPassword);
      Object.assign(updates, {
        password_hash: credentials.hash,
        password_salt: credentials.salt,
        must_change_password: true,
        active: true,
        failed_login_attempts: 0,
        locked_until: null,
      });
    }
    if (Object.keys(updates).length) {
      updates.updated_at = new Date().toISOString();
      const { error: updateError } = await supabase.from("app_users_v2").update(updates).eq("id", user.id);
      if (updateError) throw databaseError(updateError, "No fue posible actualizar los usuarios");
    }
  }
}

export async function getCurrentAppUser(): Promise<{
  auth: { sessionId: string; userId: number } | null;
  profile: AppUserProfile | null;
}> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return { auth: null, profile: null };

  await ensureAppUsers();
  const supabase = getSupabaseAdmin();
  const sessionId = await sha256(token);
  const { data: session, error: sessionError } = await supabase
    .from("app_sessions_v2")
    .select("id,user_id,expires_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) throw databaseError(sessionError, "No fue posible validar la sesión");
  if (!session || new Date(session.expires_at).getTime() <= Date.now()) {
    if (session) await supabase.from("app_sessions_v2").delete().eq("id", sessionId);
    return { auth: null, profile: null };
  }

  const { data, error } = await supabase.from("app_users_v2").select("*").eq("id", session.user_id).maybeSingle();
  if (error) throw databaseError(error, "No fue posible cargar el usuario");
  const user = data as AppUserRow | null;
  if (!user?.active) return { auth: null, profile: null };
  return { auth: { sessionId, userId: user.id }, profile: toProfile(user) };
}

export async function authenticateUser(usernameInput: string, password: string) {
  await ensureAppUsers();
  const supabase = getSupabaseAdmin();
  const username = usernameInput.trim().toLowerCase();
  const { data, error } = await supabase.from("app_users_v2").select("*").eq("username", username).maybeSingle();
  if (error) throw databaseError(error, "No fue posible validar el acceso");
  const user = data as AppUserRow | null;
  const genericError = "Usuario o clave incorrectos";
  if (!user?.active || !user.password_hash || !user.password_salt) {
    await hashPassword(password || "invalid-password");
    return { ok: false as const, error: genericError, status: 401 };
  }

  const lockExpiresAt = user.locked_until ? new Date(user.locked_until).getTime() : 0;
  if (lockExpiresAt > Date.now()) {
    return { ok: false as const, error: "Acceso bloqueado temporalmente. Intenta nuevamente en 15 minutos.", status: 429 };
  }

  if (!(await passwordMatches(password, user.password_hash, user.password_salt))) {
    const attempts = user.failed_login_attempts + 1;
    const lockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
    const { error: updateError } = await supabase.from("app_users_v2").update({
      failed_login_attempts: attempts >= 5 ? 0 : attempts,
      locked_until: lockedUntil,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    if (updateError) throw databaseError(updateError, "No fue posible registrar el intento de acceso");
    return { ok: false as const, error: genericError, status: 401 };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase.from("app_users_v2").update({
    failed_login_attempts: 0,
    locked_until: null,
    last_login_at: now,
    updated_at: now,
  }).eq("id", user.id);
  if (updateError) throw databaseError(updateError, "No fue posible completar el acceso");
  await createSession(user.id);
  return { ok: true as const, profile: toProfile(user) };
}

async function createSession(userId: number) {
  const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const id = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("app_sessions_v2").insert({ id, user_id: userId, expires_at: expiresAt });
  if (error) throw databaseError(error, "No fue posible crear la sesión");
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function signOutCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const supabase = getSupabaseAdmin();
    await supabase.from("app_sessions_v2").delete().eq("id", await sha256(token));
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function setUserPassword(userId: number, password: string, mustChangePassword = false) {
  const credentials = await hashPassword(password);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("app_users_v2").update({
    password_hash: credentials.hash,
    password_salt: credentials.salt,
    must_change_password: mustChangePassword,
    failed_login_attempts: 0,
    locked_until: null,
    updated_at: new Date().toISOString(),
  }).eq("id", userId);
  if (error) throw databaseError(error, "No fue posible cambiar la clave");
}

export async function listAppUsers() {
  await ensureAppUsers();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("app_users_v2").select("*").order("id", { ascending: true });
  if (error) throw databaseError(error, "No fue posible cargar los usuarios");
  return (data as AppUserRow[]).map(toProfile);
}

export function allowedActions(role: AppRole): readonly ("entry" | "output")[] {
  if (role === "warehouse") return ["entry"];
  if (role === "dispatch") return ["output"];
  if (role === "admin" || role === "owner") return ["entry", "output"];
  return [];
}
