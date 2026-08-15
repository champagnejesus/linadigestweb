import { allowedActions, getCurrentAppUser } from "../../../../access";
import { databaseError, databaseErrorMessage, getSupabaseAdmin } from "../../../../../db/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { profile } = await getCurrentAppUser();
    if (!profile) {
      return Response.json({ error: "Debes iniciar sesión" }, { status: 401 });
    }
    if (!allowedActions(profile.role).includes("output")) {
      return Response.json({ error: "Tu perfil no tiene permiso para anular salidas" }, { status: 403 });
    }

    const payload = (await request.json()) as { scanId?: unknown };
    const scanId = typeof payload.scanId === "string" ? payload.scanId.trim() : "";
    if (!/^scan-[a-zA-Z0-9-]{8,100}$/.test(scanId)) {
      return Response.json({ error: "Identificador de lectura no válido" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("undo_inventory_scan", {
      p_scan_id: scanId,
      p_user_id: String(profile.id),
      p_user_name: profile.name,
      p_can_manage: profile.canManageUsers,
    });
    if (error) throw databaseError(error, "No fue posible anular la lectura");

    const result = Array.isArray(data) ? data[0] : data;
    if (!result || result.status === "missing") {
      return Response.json({ error: "La lectura no existe o ya no puede anularse" }, { status: 404 });
    }
    if (result.status === "forbidden") {
      return Response.json({ error: "Solo puedes anular tus propias lecturas" }, { status: 403 });
    }
    if (result.status === "already_undone") {
      return Response.json({ error: "Esta lectura ya fue anulada" }, { status: 409 });
    }
    return Response.json({
      ok: true,
      stock: Number(result.stock),
    });
  } catch (error) {
    return Response.json({ error: databaseErrorMessage(error) }, { status: 500 });
  }
}
