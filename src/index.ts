import { Hono } from 'hono';
import { createRemoteJWKSet, jwtVerify } from 'jose';

type Bindings = {
  DB: D1Database;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
};
type Variables = { editorEmail: string };
const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const escapeHtml = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]!));
const E = escapeHtml;
const link = (path: string, label: string) => `<a href="${path}">${E(label)}</a>`;
const layout = (title: string, body: string, admin = false): string => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${E(title)} — Maker Fest Planning Hub</title><link rel="stylesheet" href="/style.css"><script src="/htmx.min.js" defer></script></head><body><nav><strong>⚙ Middlesex County Maker Fest / ${admin ? 'Admin' : 'Planning Hub'}</strong><div>${link('/','Overview')} ${link('/committees','Committees')} ${link('/programming','Programming')} ${admin ? link('/admin','Dashboard') : ''}</div></nav>${body}<footer><div class="wrap">© 2027 FUBAR Labs · Middlesex County Maker Fest · Working planning site</div></footer></body></html>`;
const section = (heading: string, body: string) => `<section><div class="wrap"><h2>${E(heading)}</h2>${body}</div></section>`;
const badge = (s: string) => `<span class="status">${E(s)}</span>`;
const errorPage = (message: string, status = 500) => new Response(layout('Notice', section('Notice', `<p>${E(message)}</p>`)), {status, headers:{'content-type':'text/html; charset=utf-8'}});

// Fail closed: Access is currently not enabled on this account. Never trust
// cf-access-authenticated-user-email alone without verifying the JWT.
app.use('/admin*', async (c, next) => {
  const domain = c.env.ACCESS_TEAM_DOMAIN?.replace(/\/$/,'');
  const audience = c.env.ACCESS_AUD;
  if (!domain || !audience || !domain.startsWith('https://')) return c.html('<h1>Admin access is not configured yet</h1><p>Enable Cloudflare Access before unlocking editing.</p>', 503);
  const token = c.req.header('Cf-Access-Jwt-Assertion');
  if (!token) return c.text('Authentication required', 401);
  try {
    const keyset = createRemoteJWKSet(new URL(`${domain}/cdn-cgi/access/certs`));
    const { payload } = await jwtVerify(token, keyset, { issuer: domain, audience });
    if (typeof payload.email !== 'string' || !payload.email) return c.text('Forbidden', 403);
    c.set('editorEmail', payload.email);
    await next();
  } catch { return c.text('Invalid authentication', 401); }
});

// Cross-site POST protections; authenticated requests must originate from
// this site. Add a dedicated synchronizer-token system before production.
app.use('/admin*', async (c, next) => {
  if (['POST','PUT','PATCH','DELETE'].includes(c.req.method)) {
    const origin = c.req.header('origin');
    const expected = new URL(c.req.url).origin;
    if (!origin || origin !== expected) return c.text('Cross-origin requests are not accepted', 403);
    if (c.req.header('sec-fetch-site') === 'cross-site') return c.text('Cross-site requests are not accepted', 403);
  }
  await next();
});

type Content = { id:string;title:string;body:string;status:string;display_order:number };
type Committee = {id:number;name:string;responsibilities:string;deliverable:string;lead_name:string|null;status:string};
type Activity = {id:number;name:string;category:string;description:string;organization:string;status:string};

app.get('/', async c => {
  const content = await c.env.DB.prepare("SELECT * FROM content_sections WHERE status='published' ORDER BY display_order").all<Content>();
  const vision = content.results.find(x => x.id === 'vision');
  const intro = E(vision?.body || 'A community-powered celebration of making and STEAM discovery.');
  const body = `<header class="hero"><div class="wrap"><span class="eyebrow">Working plan • 2026–2027</span><h1>Let's build something remarkable. Together.</h1><p>${intro}</p><p><a class="button" href="/committees">Explore committee roles →</a> <a class="button" href="/programming">View programming →</a></p></div></header>`
    + section('Our priorities', `<div class="cards"><div class="card"><h3>🤝 Organize</h3><p>Build a collaborative committee with clear ownership.</p></div><div class="card"><h3>🛠️ Create</h3><p>Recruit makers and develop interactive workshops.</p></div><div class="card"><h3>📅 Plan</h3><p>Track activities, venue requirements and milestones.</p></div></div>`)
    + section('Plan for the next 90 days', `<div class="cards"><div class="card"><h3>Founding team</h3><p>Agree on leadership and recruit workstream chairs.</p></div><div class="card"><h3>Develop program</h3><p>Approach educators, maker groups and sponsors.</p></div><div class="card"><h3>Get event-ready</h3><p>Confirm requirements, approvals and commitments.</p></div></div>`);
  return c.html(layout('Overview', body));
});
app.get('/committees', async c => {
  const data = await c.env.DB.prepare("SELECT * FROM committees WHERE status!='archived' ORDER BY id").all<Committee>();
  return c.html(layout('Committees', section('Committee structure', `<p class="muted">Proposed organizing responsibilities; unassigned leadership remains open for discussion.</p><div class="cards">${data.results.map(x => `<article class="card"><h3>${E(x.name)}</h3><p>${E(x.responsibilities)}</p><p><strong>First deliverable:</strong> ${E(x.deliverable)}</p><p>${x.lead_name ? `Lead: ${E(x.lead_name)}` : badge('Lead to be assigned')}</p></article>`).join('')}</div>`)));
});
app.get('/programming', async c => {
  const data = await c.env.DB.prepare('SELECT * FROM activities ORDER BY id').all<Activity>();
  return c.html(layout('Programming', section('Programming & activities', `<p class="muted">Proposals only. An activity is not confirmed until approved by the event leadership.</p><div class="cards">${data.results.map(x => `<article class="card"><h3>${E(x.name)}</h3><p>${E(x.description)}</p><p>${badge(x.status)} · ${E(x.category)}</p></article>`).join('')}</div>`)));
});

function adminTable(rows: Content[]) {
  return `<div id="content-table" class="wide"><table><thead><tr><th>Section</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map(r => `<tr><td>${E(r.title)}</td><td>${badge(r.status)}</td><td><a href="/admin/content/${encodeURIComponent(r.id)}">Edit</a></td></tr>`).join('')}</tbody></table></div>`;
}
app.get('/admin', async c => {
  const rows = await c.env.DB.prepare('SELECT * FROM content_sections ORDER BY display_order').all<Content>();
  return c.html(layout('Admin', section('Content management', `<p class="notice">Authenticated editor: ${E(c.get('editorEmail'))}. Changes to published sections appear on the public Planning Hub.</p>${adminTable(rows.results)}<p>${link('/admin/committees','Manage committees')} · ${link('/admin/activities','Manage activities')}</p>`),true));
});
app.get('/admin/content/:id', async c => {
  const row = await c.env.DB.prepare('SELECT * FROM content_sections WHERE id=?').bind(c.req.param('id')).first<Content>();
  if (!row) return c.notFound();
  const body = `<form hx-post="/admin/content/${encodeURIComponent(row.id)}" hx-target="#feedback" hx-swap="innerHTML" method="post"><label>Title<input name="title" maxlength="160" required value="${E(row.title)}"></label><label>Body<textarea name="body" maxlength="12000" required rows="8">${E(row.body)}</textarea></label><label>Status<select name="status"><option value="draft" ${row.status === 'draft' ? 'selected' : ''}>Draft</option><option value="published" ${row.status === 'published' ? 'selected' : ''}>Published</option></select></label><button type="submit">Save changes</button></form><div id="feedback" role="status"></div><p>${link('/admin','Back to dashboard')}</p>`;
  return c.html(layout('Edit content',section(`Edit ${row.title}`,body),true));
});
app.post('/admin/content/:id', async c => {
  const data = await c.req.parseBody();
  const title=String(data.title||'').trim(), body=String(data.body||'').trim(), status=String(data.status||'');
  if(!title||title.length>160||!body||body.length>12000||!['draft','published'].includes(status)) return c.html('<p role="alert">Invalid content.</p>',422);
  const id = c.req.param('id');
  const result=await c.env.DB.prepare('UPDATE content_sections SET title=?,body=?,status=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(title,body,status,c.get('editorEmail'),id).run();
  if(result.meta.changes!==1) return c.notFound();
  await c.env.DB.prepare('INSERT INTO audit_log(actor,action,record_type,record_id) VALUES(?,?,?,?)').bind(c.get('editorEmail'),'update','content_section',id).run();
  return c.html(`<p class="notice">Saved successfully — ${E(status)}. <a href="/">View site</a></p>`);
});
app.get('/admin/committees', async c => {
  const rows=await c.env.DB.prepare('SELECT * FROM committees ORDER BY id').all<Committee>();
  const forms=rows.results.map(r=>`<form class="card" method="post" action="/admin/committees/${r.id}"><h3>${E(r.name)}</h3><label>Lead<input name="lead_name" value="${E(r.lead_name)}" maxlength="120" placeholder="Not assigned"></label><label>Responsibilities<textarea name="responsibilities" rows="3" required maxlength="1000">${E(r.responsibilities)}</textarea></label><label>Deliverable<input name="deliverable" value="${E(r.deliverable)}" maxlength="250" required></label><button>Save committee</button></form>`).join('');
  return c.html(layout('Manage committees',section('Committee editor',`<div class="cards">${forms}</div>`),true));
});
app.post('/admin/committees/:id',async c=>{
  const f=await c.req.parseBody(),lead=String(f.lead_name||'').trim(),responsibilities=String(f.responsibilities||'').trim(),deliverable=String(f.deliverable||'').trim();
  if(lead.length>120||!responsibilities||responsibilities.length>1000||!deliverable||deliverable.length>250) return c.text('Invalid fields',422);
  const id=Number(c.req.param('id'));if(!Number.isSafeInteger(id)||id<1)return c.text('Bad ID',400);
  await c.env.DB.prepare('UPDATE committees SET lead_name=?,responsibilities=?,deliverable=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(lead||null,responsibilities,deliverable,id).run();
  await c.env.DB.prepare('INSERT INTO audit_log(actor,action,record_type,record_id) VALUES(?,?,?,?)').bind(c.get('editorEmail'),'update','committee',String(id)).run();
  return c.redirect('/admin/committees',303);
});
app.get('/admin/activities',async c=>{
  const rows=await c.env.DB.prepare('SELECT * FROM activities ORDER BY id DESC').all<Activity>();
  const form=`<form method="post" action="/admin/activities"><label>Activity name<input name="name" maxlength="160" required></label><label>Category<input name="category" maxlength="80" required></label><label>Description<textarea name="description" maxlength="2000"></textarea></label><label>Organization<input name="organization" maxlength="160"></label><button>Add proposal</button></form>`;
  return c.html(layout('Manage activities',section('Activities',form+`<div class="wide"><table><thead><tr><th>Name</th><th>Category</th><th>Status</th></tr></thead><tbody>${rows.results.map(r=>`<tr><td>${E(r.name)}</td><td>${E(r.category)}</td><td>${badge(r.status)}</td></tr>`).join('')}</tbody></table></div>`),true));
});
app.post('/admin/activities',async c=>{
  const f=await c.req.parseBody(),name=String(f.name||'').trim(),category=String(f.category||'').trim(),description=String(f.description||'').trim(),organization=String(f.organization||'').trim();
  if(!name||name.length>160||!category||category.length>80||description.length>2000||organization.length>160)return c.text('Invalid fields',422);
  const result=await c.env.DB.prepare('INSERT INTO activities(name,category,description,organization,status) VALUES(?,?,?,?,?)').bind(name,category,description,organization,'proposed').run();
  await c.env.DB.prepare('INSERT INTO audit_log(actor,action,record_type,record_id) VALUES(?,?,?,?)').bind(c.get('editorEmail'),'create','activity',String(result.meta.last_row_id)).run();
  return c.redirect('/admin/activities',303);
});
app.onError((error,c)=>{console.error(error);return c.text('Application error',500)});
export default app;
