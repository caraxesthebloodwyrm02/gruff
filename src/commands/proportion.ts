import { readFileSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import AjvModule from "ajv";
import addFormatsModule from "ajv-formats";

// Handle different ESM/CJS import styles for these packages
const Ajv = (AjvModule as any).default || AjvModule;
const addFormats = (addFormatsModule as any).default || addFormatsModule;

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = existsSync(join(__dirname, "../package.json"))
  ? resolve(__dirname, "..")
  : resolve(__dirname, "../..");
const SCHEMA_PATH = join(PKG_ROOT, "schemas/gruff-proportion-v1.schema.json");
const DEFAULT_PORT = process.env.PORT ?? "8765";
const ENDPOINT = `http://127.0.0.1:${DEFAULT_PORT}/gruff/proportion`;

export async function runProportion(file?: string): Promise<void> {
  let raw: string;
  if (file) {
    raw = readFileSync(resolve(process.cwd(), file), "utf8");
  } else {
    // read from stdin
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    raw = Buffer.concat(chunks).toString("utf8");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch (e: any) {
    process.stderr.write(`invalid JSON: ${e.message}\n`);
    process.exit(1);
  }

  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  const ajv = new Ajv({ strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(payload)) {
    process.stderr.write(
      `schema validation failed:\n${JSON.stringify(validate.errors, null, 2)}\n`,
    );
    process.exit(1);
  }

  process.stdout.write(`validated OK. POSTing to ${ENDPOINT}\n`);
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw,
  });
  const body = await res.text();
  process.stdout.write(`${res.status} ${res.statusText}\n${body}\n`);
  if (!res.ok) process.exit(1);
}
