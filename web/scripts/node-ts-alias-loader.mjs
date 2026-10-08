import { pathToFileURL } from "node:url";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const srcDir = join(scriptsDir, "..", "src");

const TRY_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs"];

/** Next.js `@/*` → `src/*` (yalnızca Node script'leri için). */
export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith("@/")) {
    return nextResolve(specifier, context);
  }

  const relative = specifier.slice(2);
  const base = join(srcDir, relative);

  if (extname(relative)) {
    return nextResolve(pathToFileURL(base).href, context);
  }

  let lastError;
  for (const ext of TRY_EXTENSIONS) {
    try {
      return await nextResolve(pathToFileURL(base + ext).href, context);
    } catch (err) {
      lastError = err;
      if (err?.code !== "ERR_MODULE_NOT_FOUND") {
        throw err;
      }
    }
  }

  throw lastError;
}
