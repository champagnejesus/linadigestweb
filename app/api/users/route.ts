import { getCurrentAppUser, hashPassword, listAppUsers, setUserPassword, type AppRole } from "../../access";
import type { AppUserRow } from "../../../db/mappers";
import { databaseError, databaseErrorMessage, getSupabaseAdmin } from "../../../db/supabase";

export const dynamic = "force-dynamic";
const ROLES = ["admin", "warehouse", "dispatch", "viewer"] as const;

function normalizedUsername(value: unknown) {
  const username = String(value ?? "").trim().toLowerCase();
  return /^[a-z0-9._-]{3,32}$/.test(username) ? username : null;
}

function roleSettings(role: AppRole) {
  return { can_view_cost: role === "admin", can_manage_users: role === "admin" };
}

async function requireManager() {
  const { auth, profile } = await getCurrentAppUser();
  if (!auth) return { response: Response.json({ error: "Debes iniciar sesión" }, { status: 401 }) };
  if (!profile?.canManageUsers) return { response: Response.json({ error: "No tienes permiso para administrar usuarios" }, { status: 403 }) };
  return { profile };
}

export async function GET() {
  try {
    const access = await requireManager();
    if ("response" in access) return access.response;
    return Response.json({ accounts: await listAppUsers() });
  } catch (error) {
    return Response.json({ error: databaseErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireManager();
    if ("response" in access) return access.response;
    const payload = (await request.json()) as { name?: string; username?: string; password?: string; role?: string };
    const name = String(payload.name ?? "").trim();
    const username = normalizedUsername(payload.username);
    const password = String(payload.password ?? "");
    const role = ROLES.includes(payload.role as (typeof ROLES)[number]) ? payload.role as AppRole : null;
    if (name.length < 2 || !username || !role || password.length < 8) {
      return Response.json({ error: "Completa nombre, usuario, perfil y una clave de al menos 8 caracteres" }, { status: 400 });
    }

    const credentials = await hashPassword(password);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("app_users_v2").insert({
      name,
      username,
      password_hash: credentials.hash,
      password_salt: credentials.salt,
      must_change_password: true,
      role,
      ...roleSettings(role),
      active: true,
      system_account: false,
    }).select("id").single();
    if (error?.code === "23505") return Response.json({ error: "Ese nombre de usuario ya está asignado" }, { status: 409 });
    if (error) throw databaseError(error, "No fue posible crear el usuario");
    const account = (await listAppUsers()).find((item) => item.id === data.id);
    return Response.json({ account }, { status: 201 });
  } catch (error) {
    return Response.json({ error: databaseErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await requireManager();
    if ("response" in access) return access.response;
    const payload = (await request.json()) as { id?: number; name?: string; username?: string; password?: string; role?: string; active?: boolean };
    const id = Number(payload.id);
    const name = String(payload.name ?? "").trim();
    const username = normalizedUsername(payload.username);
    const password = String(payload.password ?? "");
    const role = ROLES.includes(payload.role as (typeof ROLES)[number]) ? payload.role as AppRole : null;
    if (!Number.isInteger(id) || name.length < 2 || !username || !role || (password && password.length < 8)) {
      return Response.json({ error: "Completa nombre, usuario y perfil válidos; la clave nueva debe tener al menos 8 caracteres" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: existingData, error: lookupError } = await supabase.from("app_users_v2").select("*").eq("id", id).maybeSingle();
    if (lookupError) throw databaseError(lookupError, "No fue posible cargar el usuario");
    const existing = existingData as AppUserRow | null;
    if (!existing) return Response.json({ error: "Usuario no encontrado" }, { status: 404 });
    if (existing.system_account) return Response.json({ error: "La cuenta propietaria no puede modificarse desde esta pantalla" }, { status: 400 });

    const { data, error } = await supabase.from("app_users_v2").update({
      name,
      username,
      role,
      ...roleSettings(role),
      active: payload.active !== false,
      updated_at: new Date().toISOString(),
    }).eq("id", id).select("id");
    if (error?.code === "23505") return Response.json({ error: "Ese nombre de usuario ya está asignado" }, { status: 409 });
    if (error) throw databaseError(error, "No fue posible actualizar el usuario");
    if (!data?.length) return Response.json({ error: "Usuario no encontrado" }, { status: 404 });
    if (password) await setUserPassword(id, password, true);
    const account = (await listAppUsers()).find((item) => item.id === id);
    return Response.json({ account });
  } catch (error) {
    return Response.json({ error: databaseErrorMessage(error) }, { status: 500 });
  }
}
