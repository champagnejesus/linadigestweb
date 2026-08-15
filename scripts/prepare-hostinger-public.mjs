import { access, cp, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptsDirectory, "..");
const standaloneDirectory = resolve(projectRoot, "dist", "standalone");
const publicOutputDirectory = resolve(projectRoot, "public", "dist");

await rm(publicOutputDirectory, { recursive: true, force: true });

if (process.argv.includes("--clean")) {
  process.exit(0);
}

try {
  await access(resolve(standaloneDirectory, "server.js"));
} catch {
  console.error("No se encontró dist/standalone/server.js después de compilar.");
  process.exit(1);
}

await cp(standaloneDirectory, publicOutputDirectory, { recursive: true });
console.log("Prepared Hostinger output in public/dist.");
