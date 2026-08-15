# Despliegue en Hostinger con Supabase

Este paquete ya incluye `@supabase/supabase-js`, salida autónoma y servidor Node.js.

## 1. Preparar Supabase

1. Crea un proyecto en Supabase.
2. Abre **SQL Editor**, pega todo el contenido de `supabase/schema.sql` y ejecútalo una sola vez.
3. En **Project Settings → API**, copia la URL del proyecto y la clave secreta de servidor (`service_role` o secret key).

## 2. Variables de Hostinger

En **Environment variables** agrega:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LINADIGEST_PASSWORD_BODEGA`
- `LINADIGEST_PASSWORD_DESPACHO`
- `LINADIGEST_PASSWORD_MIGUEL`
- `LINADIGEST_PASSWORD_DANIELA`

Usa claves temporales nuevas de al menos 8 caracteres. No uses la clave pública `anon` en lugar de la clave secreta de servidor.

## 3. Configuración de la aplicación

- Node.js: `22.x`
- Framework: `Other`
- Build command: `npm run build`
- Output directory: `dist/standalone`
- Entry file: `server.js`
- Start command: `npm run start`

Después de guardar las variables, realiza un nuevo despliegue. Puedes comprobar la conexión visitando `/api/health`; debe responder `{"ok":true,"database":"supabase"}`.

## Seguridad

Las claves reales no están incluidas en el ZIP. `SUPABASE_SERVICE_ROLE_KEY` debe existir únicamente en Hostinger y nunca debe comenzar con `NEXT_PUBLIC_`.
