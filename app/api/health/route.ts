import { databaseError, databaseErrorMessage, getSupabaseAdmin } from "../../../db/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("products").select("id", { head: true, count: "exact" });
    if (error) throw databaseError(error, "No fue posible comprobar la base de datos");
    return Response.json({ ok: true, database: "supabase" });
  } catch (error) {
    return Response.json({ ok: false, error: databaseErrorMessage(error) }, { status: 503 });
  }
}
