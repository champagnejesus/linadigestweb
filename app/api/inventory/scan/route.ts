import { allowedActions, getCurrentAppUser } from "../../../access";
import { databaseError, databaseErrorMessage, getSupabaseAdmin } from "../../../../db/supabase";

export const dynamic = "force-dynamic";

function normalizeBarcode(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const { profile } = await getCurrentAppUser();
    if (!profile) return Response.json({ error: "Debes iniciar sesión" }, { status: 401 });
    if (!allowedActions(profile.role).includes("output")) {
      return Response.json({ error: "Tu perfil no tiene permiso para descontar productos" }, { status: 403 });
    }

    const payload = (await request.json()) as { barcode?: unknown; scanId?: unknown };
    const barcode = normalizeBarcode(payload.barcode);
    const scanId = typeof payload.scanId === "string" ? payload.scanId.trim() : "";
    if (barcode.length < 4 || barcode.length > 64 || /[\u0000-\u001f\u007f]/.test(barcode)) {
      return Response.json({ error: "Código de barras no válido" }, { status: 400 });
    }
    if (!/^scan-[a-zA-Z0-9-]{8,100}$/.test(scanId)) {
      return Response.json({ error: "Identificador de lectura no válido" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("scan_inventory_output", {
      p_barcode: barcode,
      p_scan_id: scanId,
      p_user_id: String(profile.id),
      p_user_name: profile.name,
    });
    if (error) throw databaseError(error, "No fue posible registrar la lectura");
    const result = Array.isArray(data) ? data[0] : data;
    if (!result || result.status === "unknown_barcode") {
      return Response.json({ error: "Código no reconocido. Revisa el código vinculado a LinaDigest.", code: "unknown_barcode" }, { status: 404 });
    }
    if (result.status === "out_of_stock") {
      return Response.json({ error: "No queda stock disponible", code: "out_of_stock" }, { status: 409 });
    }
    if (result.status === "label_already_used") {
      return Response.json({ error: "Esta etiqueta ya fue utilizada", code: "label_already_used" }, { status: 409 });
    }
    return Response.json({
      ok: true,
      duplicate: result.status === "duplicate",
      product: result.product_name,
      stock: Number(result.stock),
    }, { status: result.status === "duplicate" ? 200 : 201 });
  } catch (error) {
    return Response.json({ error: databaseErrorMessage(error) }, { status: 500 });
  }
}
