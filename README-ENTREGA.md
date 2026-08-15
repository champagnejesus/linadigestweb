# Inventario LinaDigest — versión Hostinger + Supabase

Proyecto completo de inventario multiusuario para LinaDigest.

## Incluye

- Acceso desplegable para Bodega, Despacho, Miguel Angel y Daniela Vasquez.
- Roles y permisos de costos/administración.
- Inventario inicial de 2.029 unidades y saldo inicial disponible de 1.438.
- Entradas, salidas, historial, Excel y PDF.
- Escáner de códigos de barras con descuento unitario y protección contra duplicados.
- Servidor autónomo para Hostinger en `dist/standalone/server.js`.
- Persistencia en Supabase con operaciones atómicas y seguridad RLS.

## Instalación

Lee `DEPLOY-HOSTINGER.md`. Antes de publicar debes:

1. Ejecutar `supabase/schema.sql` en el SQL Editor de tu proyecto Supabase.
2. Agregar en Hostinger las seis variables indicadas en `.env.example`.
3. Desplegar con `npm run build`, directorio `dist/standalone` y archivo `server.js`.

Las claves reales y el historial del servidor anterior no se incluyen en este paquete.
