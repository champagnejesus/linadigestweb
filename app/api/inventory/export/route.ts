import { getCurrentAppUser } from "../../../access";
import { movementToClient, type MovementRow } from "../../../../db/mappers";
import { databaseError, databaseErrorMessage, getSupabaseAdmin } from "../../../../db/supabase";

export const dynamic = "force-dynamic";
const MOVEMENT_TYPES = new Set(["initial", "entry", "output"]);

export async function GET(request: Request) {
  try {
    const { profile } = await getCurrentAppUser();
    if (!profile) return Response.json({ error: "Debes iniciar sesión para exportar movimientos." }, { status: 401 });

    const requestedType = new URL(request.url).searchParams.get("type");
    const supabase = getSupabaseAdmin();
    let query = supabase.from("movements").select("*").eq("product_id", 1).order("created_at", { ascending: false }).order("id", { ascending: false });
    if (requestedType && MOVEMENT_TYPES.has(requestedType)) query = query.eq("type", requestedType);
    const { data, error } = await query;
    if (error) throw databaseError(error, "No fue posible preparar la exportación");
    return Response.json({ history: ((data ?? []) as MovementRow[]).map(movementToClient) });
  } catch (error) {
    return Response.json({ error: databaseErrorMessage(error) }, { status: 500 });
  }
}
