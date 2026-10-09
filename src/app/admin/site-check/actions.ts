"use server";

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { SITE_CHECK_COPY_PATHS, validateSiteCheckCopy } from "@/lib/site-check/copy-schema";

const COPY_FILE = path.join(process.cwd(), "src/data/site-check-copy.json");

function assertDev() {
  if (process.env.NODE_ENV !== "development") throw new Error("Site Check copy can only be edited under `next dev`.");
}

function setValue(document: unknown, fieldPath: string, value: string | number) {
  const segments = fieldPath.split(".");
  let current = document as Record<string, unknown> | unknown[];
  for (const segment of segments.slice(0, -1)) {
    const next = Array.isArray(current) ? current[Number(segment)] : current[segment];
    if (!next || typeof next !== "object") throw new Error(`Couldn’t find ${fieldPath}.`);
    current = next as Record<string, unknown> | unknown[];
  }
  const last = segments.at(-1)!;
  if (Array.isArray(current)) current[Number(last)] = value;
  else current[last] = value;
}

export async function saveSiteCheckCopy(
  fieldPath: string,
  given: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    assertDev();
    if (!SITE_CHECK_COPY_PATHS.has(fieldPath)) throw new Error("That copy field isn’t editable.");
    const value = fieldPath.endsWith(".min") ? Number(given) : given;
    if (fieldPath.endsWith(".min") && !Number.isInteger(value)) throw new Error("Enter a whole-number score.");

    const document = JSON.parse(await fs.readFile(COPY_FILE, "utf8")) as unknown;
    setValue(document, fieldPath, value);
    validateSiteCheckCopy(document);

    const temporary = path.join(path.dirname(COPY_FILE), `.site-check-copy-${process.pid}-${randomUUID()}.tmp`);
    try {
      await fs.writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`);
      await fs.rename(temporary, COPY_FILE);
    } catch (error) {
      await fs.unlink(temporary).catch(() => {});
      throw error;
    }
    revalidatePath("/admin/site-check");
    revalidatePath("/site-check");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "That didn’t save." };
  }
}
