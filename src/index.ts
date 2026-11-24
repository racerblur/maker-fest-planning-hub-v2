import { Hono } from 'hono';
import { admin } from './admin';
import { choiceLabel } from './model';
import type { Env } from './security';
import { E, badge, layout, renderContent, section } from './views';

const app = new Hono<Env>();
type Content = { id:string;title:string;body:string;description:string };
type Committee = {id:number;name:string;responsibilities:string;deliverable:string;lead_name:string|null;status:string};

app.get('/', async c => {
  const content = await c.env.DB.prepare("SELECT id,live_title AS title,live_body AS body,live_description AS description FROM content_sections WHERE live_title IS NOT NULL AND archived_at IS NULL ORDER BY live_order,id").all<Content>();
  const hero = content.results.find(row => row.id === 'home-hero');
  const body = content.results.map(row => row.id === 'home-hero'
    ? `<header class="hero"><div class="wrap"><span class="eyebrow">Working plan • 2026–2027</span>
      <h1>${E(row.title)}</h1><p>${E(row.description)}</p><p class="prose">${E(row.body)}</p>
      <p><a class="button" href="/committees">Explore committee roles →</a>
      <a class="button" href="/programming">View programming →</a></p></div></header>`
    : renderContent(row)).join('');
  return c.html(layout('Overview', hero ? body : section('Middlesex County Maker Fest', '') + body));
});
app.get('/committees', async c => {
  const data = await c.env.DB.prepare("SELECT id,name,responsibilities,deliverable,lead_name,status FROM committees WHERE status!='archived' AND archived_at IS NULL ORDER BY id").all<Committee>();
  return c.html(layout('Committees', section('Committee structure', `<p class="muted">Proposed organizing responsibilities; unassigned leadership remains open for discussion.</p><div class="cards">${data.results.map(x => `<article class="card"><h3>${E(x.name)}</h3><p>${E(x.responsibilities)}</p><p><strong>First deliverable:</strong> ${E(x.deliverable)}</p><p>${x.lead_name ? `Lead: ${E(x.lead_name)}` : badge('Lead to be assigned')}</p></article>`).join('')}</div>`)));
});
for (const path of ['/programming', '/schedule']) {
  app.get(path, async c => {
    const title = path === '/schedule' ? 'Event schedule' : 'Programming & activities';
    const { results } = await c.env.DB.prepare(`
      SELECT name, category, activity_type, description, organization, presenter, location, starts_at, duration_minutes
      FROM activities WHERE status='scheduled' AND is_public=1 AND archived_at IS NULL
        AND starts_at IS NOT NULL AND location IS NOT NULL ORDER BY starts_at,id
    `).all<Record<string, string | number>>();
    const cards = results.map(row => `<article class="card"><h3>${E(row.name)}</h3>
      <p>${badge(choiceLabel(String(row.activity_type ?? row.category)))}</p><p>${E(row.description)}</p>
      <p><time datetime="${E(row.starts_at)}">${E(String(row.starts_at).replace('T',' '))} Eastern</time>
      · ${E(row.location)} · ${E(row.duration_minutes)} min</p>
      <p>${E([row.presenter,row.organization].filter(Boolean).join(' · '))}</p></article>`).join('');
    return c.html(layout(title, section(title, cards ? `<div class="cards">${cards}</div>` : '<p>No public activities are scheduled yet.</p>')));
  });
}

app.route('/admin', admin);
app.onError((error,c) => {
  console.error('Maker Fest request failed', error.name);
  return c.text('The request could not be completed.', 500);
});
export default app;
