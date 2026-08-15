export type ProductRow = {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  stock: number;
  cost: number;
  price: number;
  min_stock: number;
  unit: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type MovementRow = {
  id: number;
  product_id: number;
  type: "initial" | "entry" | "output";
  quantity: number;
  delta: number;
  reason: string;
  lot: string | null;
  expiration_date: string | null;
  note: string | null;
  source: "manual" | "scanner";
  reference: string | null;
  user_id: string;
  user_name: string;
  created_at: string;
};

export type AppUserRow = {
  id: number;
  name: string;
  email: string | null;
  username: string | null;
  password_hash: string | null;
  password_salt: string | null;
  must_change_password: boolean;
  failed_login_attempts: number;
  locked_until: string | null;
  last_login_at: string | null;
  role: "owner" | "admin" | "warehouse" | "dispatch" | "viewer";
  can_view_cost: boolean;
  can_manage_users: boolean;
  active: boolean;
  system_account: boolean;
  created_at: string;
  updated_at: string;
};

export function movementToClient(row: MovementRow) {
  return {
    id: row.id,
    productId: row.product_id,
    type: row.type,
    quantity: row.quantity,
    delta: row.delta,
    reason: row.reason,
    lot: row.lot,
    expirationDate: row.expiration_date,
    note: row.note,
    source: row.source,
    reference: row.reference,
    userId: row.user_id,
    userName: row.user_name,
    createdAt: row.created_at,
  };
}
