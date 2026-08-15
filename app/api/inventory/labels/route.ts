import { allowedActions, getCurrentAppUser } from "../../../access";
import { formatLabelCode } from "../../../label-codes";
import { databaseError, databaseErrorMessage, getSupabaseAdmin } from "../../../../db/supabase";

export const dynamic = "force-dynamic";

const LABEL_SIZES = new Set(["standard", "compact"]);

export async function POST(request: Request) {
  try {
    const { profile } = await getCurrentAppUser();
    if (!profile) {
      return Response.json({ error: "Debes iniciar sesión" }, { status: 401 });
    }
    if (!allowedActions(profile.role).includes("output")) {
      return Response.json(
        { error: "Tu perfil no tiene permiso para imprimir etiquetas" },
        { status: 403 },
      );
    }

    const payload = (await request.json()) as { productId?: unknown; labelSize?: unknown };
    const productId = Number(payload.productId);
    const labelSize = typeof payload.labelSize === "string" ? payload.labelSize : "";
    if (!Number.isSafeInteger(productId) || productId < 1 || !LABEL_SIZES.has(labelSize)) {
      return Response.json({ error: "Datos de etiqueta no válidos" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("active", true)
      .maybeSingle();
    if (productError) throw databaseError(productError, "No fue posible consultar el producto");
    if (!product) {
      return Response.json({ error: "El producto no está disponible" }, { status: 404 });
    }

    const { data: label, error: labelError } = await supabase
      .from("label_prints")
      .insert({
        product_id: productId,
        label_size: labelSize,
        printed_by_user_id: String(profile.id),
        printed_by_user_name: profile.name,
      })
      .select("id")
      .single();
    if (labelError) throw databaseError(labelError, "No fue posible generar el código único");

    const sequence = Number(label.id);
    if (!Number.isSafeInteger(sequence) || sequence < 1) {
      throw new Error("La base de datos no devolvió un número de impresión válido");
    }

    return Response.json({
      ok: true,
      code: formatLabelCode(sequence),
      sequence,
    }, { status: 201 });
  } catch (error) {
    return Response.json({ error: databaseErrorMessage(error) }, { status: 500 });
  }
}
