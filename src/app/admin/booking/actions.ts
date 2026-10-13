"use server";

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { reasonOf } from "@/lib/booking/log";
import { availableSlots } from "@/lib/booking/service";
import { type BookingSettings, validateBookingSettings } from "@/lib/booking/settings";

const SETTINGS_FILE = path.join(process.cwd(), "src/data/booking.json");

function assertDev() {
  if (process.env.NODE_ENV !== "development") throw new Error("Booking settings can only be edited under `next dev`.");
}

/** The settings as they are on disk now, rather than as this module first imported them. */
export async function readBookingSettings() {
  assertDev();
  return validateBookingSettings(JSON.parse(await fs.readFile(SETTINGS_FILE, "utf8")));
}

/** Checks and saves the whole settings object; the rules depend on each other, so it's never saved a field at a time. */
export async function saveBookingSettings(
  draft: BookingSettings,
): Promise<{ ok: true; settings: BookingSettings } | { ok: false; error: string }> {
  try {
    assertDev();
    const settings = validateBookingSettings(draft);
    const temporary = path.join(path.dirname(SETTINGS_FILE), `.booking-${process.pid}-${randomUUID()}.tmp`);
    try {
      await fs.writeFile(temporary, `${JSON.stringify(settings, null, 2)}\n`);
      await fs.rename(temporary, SETTINGS_FILE);
    } catch (error) {
      await fs.unlink(temporary).catch(() => {});
      throw error;
    }
    revalidatePath("/admin/booking");
    revalidatePath("/book");
    return { ok: true, settings };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "That didn’t save." };
  }
}

/** The times the draft would offer now, against the real calendars when Google is set up. */
export async function previewSlots(
  draft: BookingSettings,
): Promise<{ ok: true; slots: string[] } | { ok: false; error: string }> {
  try {
    assertDev();
    return { ok: true, slots: await availableSlots(validateBookingSettings(draft)) };
  } catch (error) {
    return { ok: false, error: reasonOf(error) };
  }
}
