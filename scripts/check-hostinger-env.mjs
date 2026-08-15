const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "LINADIGEST_PASSWORD_BODEGA",
  "LINADIGEST_PASSWORD_DESPACHO",
  "LINADIGEST_PASSWORD_MIGUEL",
  "LINADIGEST_PASSWORD_DANIELA",
];

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Faltan variables en Hostinger: ${missing.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("Configuración de Hostinger completa.");
}
