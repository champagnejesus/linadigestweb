import { allowedActions, getCurrentAppUser, listAppUsers } from "../../access";
import { movementToClient, type MovementRow, type ProductRow } from "../../../db/mappers";
import { databaseError, databaseErrorMessage, getSupabaseAdmin } from "../../../db/supabase";

export const dynamic = "force-dynamic";

type MovementType = "entry" | "output";
const INITIAL_QUANTITY = 2029;

async function ensureInitialInventory() {
  const supabase = getSupabaseAdmin();
  const { error: productError } = await supabase.from("products").upsert({
    id: 1,
    name: "LinaDigest",
    sku: "LD-400G",
    stock: 1438,
    cost: 12000,
    price: 29990,
    min_stock: 300,
    unit: "frasco 400 g",
    active: true,
  }, { onConflict: "id", ignoreDuplicates: true });
  if (productError) throw databaseError(productError, "No fue posible preparar el producto");

  const { error: movementError } = await supabase.from("movements").upsert({
    id: 1,
    product_id: 1,
    type: "initial",
    quantity: INITIAL_QUANTITY,
    delta: INITIAL_QUANTITY,
    reason: "Stock inicial",
    note: "Cantidad inicial corregida; saldo disponible conservado",
    source: "manual",
    user_id: "system",
    user_name: "Sistema LinaDigest",
  }, { onConflict: "id", ignoreDuplicates: true });
  if (movementError) throw databaseError(movementError, "No fue posible preparar el inventario inicial");

  const { error: updateError } = await supabase.from("movements").update({
    quantity: INITIAL_QUANTITY,
    delta: INITIAL_QUANTITY,
    note: "Cantidad inicial corregida; saldo disponible conservado",
  }).eq("id", 1);
  if (updateError) throw databaseError(updateError, "No fue posible verificar el inventario inicial");
}

function accessError(authenticated: boolean) {
  return Response.json(
    {
      error: authenticated
        ? "Tu cuenta todavía no está habilitada. Pide a un administrador que asigne tu perfil."
        : "Debes iniciar sesión para acceder al inventario.",
      code: authenticated ? "not_allowed" : "not_signed_in",
    },
    { status: authenticated ? 403 : 401 },
  );
}

export async function GET() {
  try {
    const { auth, profile } = await getCurrentAppUser();
    if (!profile) return accessError(Boolean(auth));

    await ensureInitialInventory();
    const supabase = getSupabaseAdmin();
    const [{ data: productData, error: productError }, { data: historyData, error: historyError }] = await Promise.all([
      supabase.from("products").select("*").eq("id", 1).maybeSingle(),
      supabase.from("movements").select("*").eq("product_id", 1).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(500),
    ]);
    if (productError) throw databaseError(productError, "No fue posible cargar el producto");
    if (historyError) throw databaseError(historyError, "No fue posible cargar los movimientos");
    const product = productData as ProductRow | null;
    const historyRows = (historyData ?? []) as MovementRow[];
    if (!product) return Response.json({ error: "Producto no encontrado" }, { status: 404 });

    const entries = historyRows.filter((movement) => movement.type === "entry").reduce((sum, movement) => sum + movement.quantity, 0);
    const outputs = historyRows.filter((movement) => movement.type === "output").reduce((sum, movement) => sum + movement.quantity, 0);
    const accounts = profile.canManageUsers ? await listAppUsers() : [];

    return Response.json({
      currentUser: {
        id: profile.id,
        name: profile.name,
        username: profile.username,
        role: profile.role,
        canViewCost: profile.canViewCost,
        canManageUsers: profile.canManageUsers,
        mustChangePassword: profile.mustChangePassword,
      },
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        stock: product.stock,
        initialStock: INITIAL_QUANTITY,
        cost: profile.canViewCost ? product.cost : null,
        price: product.price,
        minStock: product.min_stock,
        unit: product.unit,
        stockValue: profile.canViewCost ? product.stock * product.cost : null,
        projectedMargin: profile.canViewCost ? product.stock * (product.price - product.cost) : null,
        updatedAt: product.updated_at,
      },
      history: historyRows.map(movementToClient),
      accounts,
      stats: { entries, outputs },
      permissions: {
        canViewCost: profile.canViewCost,
        canManageUsers: profile.canManageUsers,
        allowed: allowedActions(profile.role),
      },
    });
  } catch (error) {
    return Response.json({ error: databaseErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { auth, profile } = await getCurrentAppUser();
    if (!profile) return accessError(Boolean(auth));
    const payload = (await request.json()) as {
      type?: string;
      quantity?: number;
      reason?: string;
      lot?: string;
      expirationDate?: string;
      note?: string;
    };

    if (payload.type !== "entry" && payload.type !== "output") {
      return Response.json({ error: "Tipo de movimiento no válido" }, { status: 400 });
    }
    const type = payload.type as MovementType;
    if (!allowedActions(profile.role).includes(type)) {
      return Response.json({ error: "Tu perfil no tiene permiso para registrar ese movimiento" }, { status: 403 });
    }
    const quantity = Number(payload.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000000) {
      return Response.json({ error: "Ingresa una cantidad válida" }, { status: 400 });
    }

    await ensureInitialInventory();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("register_inventory_movement", {
      p_product_id: 1,
      p_type: type,
      p_quantity: quantity,
      p_reason: payload.reason?.trim() || (type === "entry" ? "Entrada" : "Salida"),
      p_lot: payload.lot?.trim() || null,
      p_expiration_date: payload.expirationDate || null,
      p_note: payload.note?.trim() || null,
      p_user_id: String(profile.id),
      p_user_name: profile.name,
    });
    if (error) {
      const insufficient = error.message.match(/insufficient_stock:(\d+)/i);
      if (insufficient) {
        return Response.json({ error: `Stock insuficiente. Disponibles: ${insufficient[1]}` }, { status: 409 });
      }
      throw databaseError(error, "No fue posible registrar el movimiento");
    }
    const result = Array.isArray(data) ? data[0] : data;
    return Response.json({ ok: true, stock: Number(result?.new_stock ?? result?.stock) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: databaseErrorMessage(error) }, { status: 500 });
  }
}
