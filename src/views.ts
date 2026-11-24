const escapeHtml = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]!));
export const E = escapeHtml;
export const link = (path: string, label: string) => `<a href="${path}">${E(label)}</a>`;
export const layout = (title: string, body: string, admin = false): string => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${E(title)} — Maker Fest Planning Hub</title><link rel="stylesheet" href="/style.css"><meta name="htmx-config" content='{"includeIndicatorStyles":false,"allowEval":false,"allowScriptTags":false}'>
<script src="/htmx.min.js" defer></script></head><body><a class="skip" href="#main">Skip to content</a><nav aria-label="Main navigation"><strong>⚙ Middlesex County Maker Fest / ${admin ? 'Admin' : 'Planning Hub'}</strong><div>${link('/','Overview')} ${link('/committees','Committees')} ${link('/programming','Programming')} ${link('/schedule','Schedule')} ${admin ? link('/admin','Dashboard') : ''}</div></nav><main id="main" tabindex="-1">${body}</main><footer><div class="wrap">© 2027 FUBAR Labs · Middlesex County Maker Fest · Working planning site</div></footer></body></html>`;
export const section = (heading: string, body: string) => `<section><div class="wrap"><h2>${E(heading)}</h2>${body}</div></section>`;
export const badge = (s: string) => `<span class="status">${E(s)}</span>`;

export function renderContent(row: { title: unknown; description: unknown; body: unknown }) {
  return section(String(row.title), `<p class="muted">${E(row.description)}</p><p class="prose">${E(row.body)}</p>`);
}
