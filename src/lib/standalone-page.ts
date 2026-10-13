import { SITE } from "@/data/site";

export const esc = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * A small page in the site's look, for routes that answer an emailed link (the site
 * check's confirmation, the booking's manage link) outside the app's layout.
 * `message` and `form` are HTML, so escape anything from outside with `esc`.
 */
export const standalonePage = ({
  title,
  message,
  form,
  back,
  status = 200,
}: {
  title: string;
  message: string;
  form?: string;
  back: { href: string; label: string };
  status?: number;
}) => {
  const safeTitle = esc(title);
  // This standalone response does not inherit globals.css; these are its palette and body-type tokens.
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${safeTitle} · ${SITE.name}</title><link rel="preconnect" href="https://use.typekit.net" crossorigin><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://use.typekit.net/llb6krb.css"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600&display=swap"><style>@font-face{font-family:"Hanken Grotesk Fallback";src:local("Arial");ascent-override:99.07%;descent-override:30.02%;line-gap-override:0%;size-adjust:100.94%}:root{--color-paper-light:hsl(24 28% 96%);--color-paper:hsl(18 25.2% 92%);--color-sand:hsl(15 24.1% 90%);--color-body:hsl(288 11.3% 32%);--color-ink:hsl(264 10.3% 16%);--color-pink:hsl(350 100% 65%);--font-sans:"Hanken Grotesk","Hanken Grotesk Fallback",ui-sans-serif,system-ui,sans-serif}body{box-sizing:border-box;margin:0;min-height:100vh;padding:1rem;display:grid;place-items:center;background:var(--color-paper);color:var(--color-body);font:18px/1.5 var(--font-sans)}.frame{border-radius:4px;background:var(--color-paper-light);box-shadow:0 1px 1px color-mix(in srgb,var(--color-body) 4%,transparent),0 2px 4px color-mix(in srgb,var(--color-body) 8%,transparent)}.confirmation{box-sizing:border-box;width:100%;max-width:37.5rem;padding:2rem}.confirmation__header{padding:0 0 1.25rem}.confirmation__brand{display:inline-block;color:var(--color-ink)}.confirmation__logo{display:block;width:8.25rem;height:auto}.confirmation__rule{margin:0;border:0;border-top:1px solid var(--color-sand)}.confirmation__content{padding:2.25rem 0 0}h1{margin:0 0 1.5rem;color:var(--color-ink);font:400 2rem/1.07 gelica,Georgia,serif;letter-spacing:-.022em}p{margin:0 0 1.25rem}form{margin:.5rem 0 1.75rem}button{min-height:3.5rem;padding:0 1.5rem;border:0;border-radius:2px;background:var(--color-pink);color:var(--color-ink);cursor:pointer;font:500 14px/1.6 ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase}button span{display:inline-block;margin-left:.2em}a{color:var(--color-ink)}</style></head><body><main class="frame confirmation"><header class="confirmation__header"><a class="confirmation__brand" href="/" aria-label="${esc(SITE.name)}"><img class="confirmation__logo" src="/assets/okayplus.svg" width="132" height="31" alt="${esc(SITE.name)}"></a></header><hr class="confirmation__rule"><section class="confirmation__content"><h1>${safeTitle}</h1><p>${message}</p>${form ?? ""}<p><a href="${esc(back.href)}">${esc(back.label)} <span aria-hidden="true">→</span></a></p></section></main></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
};
