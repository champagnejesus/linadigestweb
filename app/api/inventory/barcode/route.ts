import { getCurrentAppUser } from "../../../access";
import { databaseError, databaseErrorMessage, getSupabaseAdmin } from "../../../../db/supabase";

export const dynamic = "force-dynamic";

function normalizeBarcode(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const { profile } = await getCurrentAppUser();
    if (!profile) return Response.json({ error: "Debes iniciar sesión" }, { status: 401 });
    if (!profile.canManageUsers) {
      return Response.json({ error: "Solo Miguel Angel o Daniela Vasquez pueden vincular el código de barras" }, { status: 403 });
    }

    const payload = (await request.json()) as { productId?: unknown; barcode?: unknown };
    const productId = Number(payload.productId);
    const barcode = normalizeBarcode(payload.barcode);
    if (!Number.isInteger(productId) || productId < 1) return Response.json({ error: "Producto no válido" }, { status: 400 });
    if (barcode.length < 4 || barcode.length > 64 || /[\u0000-\u001f\u007f]/.test(barcode)) {
      return Response.json({ error: "El código de barras no es válido" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("products").update({
      barcode,
      updated_at: new Date().toISOString(),
    }).eq("id", productId).select("id,barcode");
    if (error?.code === "23505") return Response.json({ error: "Ese código ya está vinculado a otro producto" }, { status: 409 });
    if (error) throw databaseError(error, "No fue posible guardar el código");
    if (!data?.length) return Response.json({ error: "Producto no encontrado" }, { status: 404 });
    return Response.json({ ok: true, barcode });
  } catch (error) {
    return Response.json({ error: databaseErrorMessage(error) }, { status: 500 });
  }
}
