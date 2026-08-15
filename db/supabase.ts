import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export class DatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigurationError";
  }
}

function readDatabaseEnvironment() {
  const url = process.env.SUPABASE_URL?.trim()
    || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    || process.env.SUPABASE_API_KEY?.trim()
    || "";

  if (!url) {
    throw new DatabaseConfigurationError(
      "Falta SUPABASE_URL en las variables de entorno de Hostinger.",
    );
  }
  if (!key) {
    throw new DatabaseConfigurationError(
      "Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno de Hostinger.",
    );
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error();
  } catch {
    throw new DatabaseConfigurationError(
      "SUPABASE_URL no es una dirección válida. Cópiala desde Supabase → Project Settings → API.",
    );
  }

  if (key.length < 20) {
    throw new DatabaseConfigurationError(
      "La clave de Supabase no es válida. Usa la clave secreta de servidor (service_role o secret key).",
    );
  }

  return { url, key };
}

export function getSupabaseAdmin() {
  if (cachedClient) return cachedClient;
  const { url, key } = readDatabaseEnvironment();
  cachedClient = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: { "X-Client-Info": "linadigest-inventario-hostinger" },
    },
  });
  return cachedClient;
}

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export function databaseError(error: SupabaseErrorLike | null, action: string) {
  if (!error) return null;
  const raw = [error.message, error.details, error.hint].filter(Boolean).join(" ");
  if (/invalid api key|no api key|jwt/i.test(raw)) {
    return new DatabaseConfigurationError(
      "La clave de Supabase fue rechazada. Revisa SUPABASE_SERVICE_ROLE_KEY en Hostinger.",
    );
  }
  if (/relation .* does not exist|schema cache|could not find the (table|function)/i.test(raw)) {
    return new DatabaseConfigurationError(
      "La base de Supabase todavía no está preparada. Ejecuta el archivo supabase/schema.sql en SQL Editor.",
    );
  }
  return new Error(`${action}: ${error.message || "error de base de datos"}`);
}

export function databaseErrorMessage(error: unknown) {
  if (error instanceof DatabaseConfigurationError) return error.message;
  if (error instanceof Error) return error.message;
  return "No fue posible conectar con la base de datos.";
}
