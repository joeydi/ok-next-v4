export type SiteCheckCopy = {
  score: {
    label: string;
    note: string;
    pending: string;
    verdicts: { min: number; message: string }[];
  };
  review: {
    heading: string;
    body: string;
    label: string;
    placeholder: string;
    cta: string;
    note: string;
    error: string;
    errors: {
      "bad-email": string;
      "disposable-email": string;
      "no-mail-server": string;
      "email-limit": string;
      "already-requested": string;
      "rate-limited": string;
    };
  };
  sent: { label: string; heading: string; message: string; booking: string };
  confirmation: {
    back: string;
    expired: { title: string; message: string };
    prompt: { title: string; message: string; action: string };
    failed: { title: string; message: string };
    confirmed: { title: string; message: string };
  };
  emails: {
    confirmation: { subject: string; intro: string; expiry: string; signature: string };
    review: { subject: string; request: string; score: string; run: string; attachment: string };
  };
};

const ERROR_KEYS = [
  "bad-email",
  "disposable-email",
  "no-mail-server",
  "email-limit",
  "already-requested",
  "rate-limited",
] as const;

const STRING_PATHS = [
  "score.label",
  "score.note",
  "score.pending",
  "review.heading",
  "review.body",
  "review.label",
  "review.placeholder",
  "review.cta",
  "review.note",
  "review.error",
  ...ERROR_KEYS.map((key) => `review.errors.${key}`),
  "sent.label",
  "sent.heading",
  "sent.message",
  "sent.booking",
  "confirmation.back",
  "confirmation.expired.title",
  "confirmation.expired.message",
  "confirmation.prompt.title",
  "confirmation.prompt.message",
  "confirmation.prompt.action",
  "confirmation.failed.title",
  "confirmation.failed.message",
  "confirmation.confirmed.title",
  "confirmation.confirmed.message",
  "emails.confirmation.subject",
  "emails.confirmation.intro",
  "emails.confirmation.expiry",
  "emails.confirmation.signature",
  "emails.review.subject",
  "emails.review.request",
  "emails.review.score",
  "emails.review.run",
  "emails.review.attachment",
] as const;

export const SITE_CHECK_COPY_PATHS = new Set<string>([
  ...STRING_PATHS,
  ...Array.from({ length: 4 }, (_, index) => [`score.verdicts.${index}.min`, `score.verdicts.${index}.message`]).flat(),
]);

const objectAt = (value: unknown, path: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path} must be an object.`);
  return value as Record<string, unknown>;
};

export function valueAt(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (Array.isArray(current)) return current[Number(segment)];
    return objectAt(current, path)[segment];
  }, value);
}

const TOKENS = /{{([a-zA-Z][a-zA-Z0-9]*)}}/g;

const templateRules: Record<string, readonly string[]> = {
  "sent.message": ["email", "host"],
  "confirmation.expired.message": ["supportEmail"],
  "confirmation.failed.message": ["supportEmail"],
  "confirmation.confirmed.message": ["host", "email"],
  "emails.confirmation.subject": ["host"],
  "emails.confirmation.intro": ["host"],
  "emails.confirmation.signature": ["author", "siteName"],
  "emails.review.subject": ["host", "score"],
  "emails.review.request": ["email", "url"],
  "emails.review.score": ["score", "verdict"],
  "emails.review.run": ["runId", "checkedAt"],
};

export function validateSiteCheckCopy(value: unknown): SiteCheckCopy {
  objectAt(value, "Site Check copy");
  for (const path of STRING_PATHS) {
    const field = valueAt(value, path);
    if (typeof field !== "string" || !field.trim()) throw new Error(`${path} must be a non-empty string.`);
  }

  const verdicts = valueAt(value, "score.verdicts");
  if (!Array.isArray(verdicts) || verdicts.length !== 4) throw new Error("score.verdicts must contain four tiers.");
  let previous = 101;
  for (const [index, verdict] of verdicts.entries()) {
    const entry = objectAt(verdict, `score.verdicts.${index}`);
    if (!Number.isInteger(entry.min) || (entry.min as number) < 0 || (entry.min as number) > 100) {
      throw new Error(`score.verdicts.${index}.min must be a whole number from 0 to 100.`);
    }
    if ((entry.min as number) >= previous) throw new Error("Score tier minimums must descend without overlap.");
    if (typeof entry.message !== "string" || !entry.message.trim()) {
      throw new Error(`score.verdicts.${index}.message must be a non-empty string.`);
    }
    previous = entry.min as number;
  }
  if ((verdicts.at(-1) as { min: number }).min !== 0) throw new Error("The last score tier must start at 0.");

  for (const [path, required] of Object.entries(templateRules)) {
    const template = valueAt(value, path) as string;
    const found = [...template.matchAll(TOKENS)].map((match) => match[1]);
    const missing = required.filter((token) => !found.includes(token));
    const unknown = found.filter((token) => !required.includes(token));
    if (missing.length) throw new Error(`${path} is missing ${missing.map((token) => `{{${token}}}`).join(", ")}.`);
    if (unknown.length) throw new Error(`${path} has unknown ${unknown.map((token) => `{{${token}}}`).join(", ")}.`);
  }
  return value as SiteCheckCopy;
}

export function formatTemplate(template: string, values: Record<string, string | number>) {
  return template.replace(TOKENS, (_, key: string) => {
    if (!(key in values)) throw new Error(`No value supplied for {{${key}}}.`);
    return String(values[key]);
  });
}

export function templateParts(template: string, values: Record<string, string | number>) {
  return template
    .split(/({{[a-zA-Z][a-zA-Z0-9]*}})/)
    .filter(Boolean)
    .map((part) => {
      const match = /^{{([a-zA-Z][a-zA-Z0-9]*)}}$/.exec(part);
      if (!match) return { key: null, text: part };
      if (!(match[1] in values)) throw new Error(`No value supplied for ${part}.`);
      return { key: match[1], text: String(values[match[1]]) };
    });
}
