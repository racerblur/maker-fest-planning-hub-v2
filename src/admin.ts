import { Hono } from 'hono';
import type { Context } from 'hono';
import { areas, choiceLabel, type Area } from './model';
import { protectAdmin, type Env } from './security';
import { E, badge, layout, link, renderContent, section } from './views';

type Row = Record<string, string | number | null>;
type AdminContext = Context<Env, '/:area/:id'>;
export const admin = new Hono<Env>();
admin.use('*', protectAdmin);

function page(c: Context<Env>, title: string, body: string, wrap = true) {
  const navigation = Object.entries(areas).filter(([, area]) => !area.admin || c.get('role') === 'admin')
    .map(([key, area]) => link('/admin/' + key, area.title)).join(' ');
  const audit = c.get('role') === 'admin' ? link('/admin/audit', 'Audit log') : '';
  return c.html(layout(title, `<nav class="admin-nav" aria-label="Management">${navigation} ${audit}</nav>`
    + (wrap ? section(title, body) : body), true));
}

function getArea(c: Context<Env>, key: string) {
  const area = Object.hasOwn(areas, key) ? areas[key] : undefined;
  return area && (!area.admin || c.get('role') === 'admin') ? area : undefined;
}

function titleOf(row: Row) {
  return String(row.title ?? row.name ?? row.email);
}

function recordStatus(row: Row) {
  if (row.archived_at || row.status === 'archived') return 'archived';
  if (row.live_title && row.status === 'draft') return 'draft changes';
  return row.status ?? row.role ?? '';
}

async function renderForm(c: Context<Env>, area: Area, path: string, row?: Row, edit = Boolean(row)) {
  const inputs = await Promise.all(area.fields.map(async field => {
    const value = row?.[field.key] ?? (field.key === 'display_order' ? 100 : '');
    const required = field.required ? 'required' : '';
    const max = field.max ?? 160;
    let control;
    if (field.relation || field.choices) {
      const relationRows = field.relation ? (await c.env.DB.prepare(
        `SELECT id,name FROM ${field.relation} WHERE archived_at IS NULL OR id=? ORDER BY name`,
      ).bind(value).all<Row>()).results : [];
      const options = field.choices?.map(item => [item, choiceLabel(item)])
        ?? relationRows.map(item => [String(item.id), String(item.name)]);
      if (!field.choices && !field.required) options.unshift(['','Unassigned']);
      if (field.choices && value && !options.some(([key]) => key === String(value))) options.unshift([String(value), choiceLabel(String(value))]);
      control = `<select name="${field.key}" ${required}>${options.map(([key, label]) =>
        `<option value="${E(key)}" ${key === String(value) ? 'selected' : ''}>${E(label)}</option>`).join('')}</select>`;
    } else if (field.type === 'textarea') {
      control = `<textarea name="${field.key}" rows="4" maxlength="${max}" ${required}>${E(value)}</textarea>`;
    } else {
      const limit = field.type === 'number' ? `min="0" max="${max}" step="1"` : `maxlength="${max}"`;
      control = `<input type="${field.type ?? 'text'}" name="${field.key}" value="${E(value)}" ${limit} ${required}>`;
    }
    return `<label>${E(field.label)}${control}</label>`;
  }));
  const revision = row && edit ? `<input type="hidden" name="revision" value="${E(row.revision)}">` : '';
  const content = area.table === 'content_sections';
  const publish = content && c.get('role') === 'admin' ? '<button name="operation" value="publish">Publish</button>' : '';
  const preview = content ? '<button name="operation" value="preview">Preview draft</button>' : '';
  return `<form method="post" action="${E(path)}">${revision}${inputs.join('')}
    <div class="actions"><button name="operation" value="save">${content ? 'Save draft' : 'Save'}</button>${preview}${publish}</div></form>`;
}

admin.get('/', c => page(c, 'Organizer dashboard',
  `<p>Signed in as ${E(c.get('email'))} (${E(c.get('role'))}). Choose a management area above.</p>`));

admin.get('/audit', async c => {
  if (c.get('role') !== 'admin') return c.text('Forbidden', 403);
  const { results } = await c.env.DB.prepare('SELECT created_at,actor,action,record_type,record_id FROM audit_log ORDER BY id DESC LIMIT 100').all<Row>();
  return page(c, 'Audit log', `<div class="wide"><table><caption>Most recent 100 changes (UTC)</caption>
    <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Record type</th><th>Record ID</th></tr></thead>
    <tbody>${results.map(row => `<tr>${Object.values(row).map(value => `<td>${E(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
});

admin.get('/:area', async c => {
  const key = c.req.param('area');
  const area = getArea(c, key);
  if (!area) return c.notFound();
  const base = '/admin/' + key;
  const statusField = key === 'tasks' ? area.fields.find(field => field.key === 'status') : undefined;
  const choices = statusField?.choices ?? [];
  const filter = c.req.query('status') ?? '';
  const statement = c.env.DB.prepare(`SELECT * FROM ${area.table}
    ${choices.includes(filter) ? 'WHERE status=?' : ''}
    ORDER BY ${key === 'schedule' ? 'starts_at IS NULL,starts_at,id' : key === 'content' ? 'display_order,id' : 'id DESC'}`);
  const { results } = await (choices.includes(filter) ? statement.bind(filter) : statement).all<Row>();
  const filterForm = statusField ? `<form method="get" action="${base}" hx-get="${base}" hx-target="#task-results" hx-select="#task-results" hx-swap="outerHTML" hx-push-url="true"><label>Task status
    <select name="status"><option value="">All statuses</option>${choices.map(choice =>
      `<option value="${choice}" ${filter === choice ? 'selected' : ''}>${E(choiceLabel(choice))}</option>`).join('')}</select></label>
    <button>Filter</button></form>` : '';
  const details = key === 'schedule' ? '<th scope="col">Start (Eastern)</th><th scope="col">Location</th>'
    : key === 'content' ? '<th scope="col">Order</th>' : key === 'tasks' ? '<th scope="col">Owner</th><th scope="col">Deadline</th>' : '';
  return page(c, area.title, `${c.req.query('saved') === '1' ? '<p class="notice" role="status">Changes saved.</p>' : ''}
    <p><a class="button" href="${base}/new">Add record</a></p>${filterForm}
    <div id="task-results" aria-live="polite"><div class="wide"><table><thead><tr><th scope="col">Record</th><th scope="col">Status</th>${details}</tr></thead>
    <tbody>${results.map(row => `<tr><td>${link(base + '/' + encodeURIComponent(String(row.id)), titleOf(row))}</td>
      <td>${badge(choiceLabel(String(recordStatus(row))))}</td>
      ${key === 'schedule' ? `<td>${E(String(row.starts_at ?? '').replace('T', ' '))}</td><td>${E(row.location)}</td>`
        : key === 'content' ? `<td>${E(row.display_order)}</td>` : key === 'tasks' ? `<td>${E(row.owner)}</td><td>${E(row.due_date)}</td>` : ''}</tr>`).join('')}</tbody></table></div>
    ${results.length ? '' : '<p>No records found.</p>'}</div>`);
});

async function find(c: Context<Env>, area: Area, id: string) {
  return c.env.DB.prepare(`SELECT * FROM ${area.table} WHERE id=?`).bind(id).first<Row>();
}

admin.get('/:area/:id', async c => {
  const { area: key, id } = c.req.param();
  const area = getArea(c, key);
  if (!area) return c.notFound();
  const base = '/admin/' + key;
  const path = base + '/' + encodeURIComponent(id);
  const back = `<p>${link(base, 'Back to ' + area.title.toLowerCase())}</p>`;
  if (id === 'new') return page(c, 'Add record', back + await renderForm(c, area, path));
  const row = await find(c, area, id);
  if (!row) return c.notFound();
  const archived = recordStatus(row) === 'archived';
  const action = archived ? 'restore' : 'archive';
  const confirmation = c.get('role') === 'admin' ? `<details><summary>${archived ? 'Restore record' : 'Archive record'}</summary>
    <form action="${E(path)}" method="post"><input type="hidden" name="revision" value="${E(row.revision)}">
      <label><input type="checkbox" name="confirm" value="yes" required> Confirm ${action}</label>
      <button name="operation" value="${action}">${archived ? 'Restore' : 'Archive'}</button></form></details>` : '';
  return page(c, titleOf(row), back + (archived ? '<p>This record is archived.</p>' : await renderForm(c, area, path, row)) + confirmation);
});

function validDate(value: string, dateTime: boolean) {
  const format = dateTime ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/;
  if (!format.test(value)) return false;
  const date = new Date(dateTime ? value + 'Z' : value);
  return Number.isFinite(date.valueOf()) && date.toISOString().startsWith(value);
}

async function validate(c: AdminContext, area: Area, data: URLSearchParams, existing?: Row) {
  const values: Row = {};
  for (const field of area.fields) {
    const raw = data.get(field.key);
    if (typeof raw !== 'string') return { error: field.label };
    const value = raw.trim();
    if ((!value && field.required) || value.length > (field.type === 'number' ? 12 : field.max ?? 160)) return { error: field.label };
    if (field.choices && !field.choices.includes(value)) return { error: field.label };
    if (field.relation && value) {
      const related = /^[1-9]\d{0,14}$/.test(value) && await c.env.DB.prepare(
        `SELECT id FROM ${field.relation} WHERE id=? AND (archived_at IS NULL OR id=?)`,
      ).bind(value, existing?.[field.key] ?? null).first();
      if (!related) return { error: field.label };
    }
    if (value && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { error: field.label };
    if (value && (field.type === 'date' || field.type === 'datetime-local') && !validDate(value, field.type === 'datetime-local')) return { error: field.label };
    if (field.type === 'number' && value && (!/^\d+$/.test(value) || Number(value) > field.max!)) return { error: field.label };
    values[field.key] = field.type === 'number' || field.relation ? (value ? Number(value) : null) : value;
  }
  if (area.table === 'activities') {
    values.is_public = Number(values.is_public);
    if (values.status === 'scheduled' && (!values.starts_at || !values.location || !values.duration_minutes || !values.activity_type)) {
      return { error: 'Scheduled activities require a date and time, location, duration and activity type' };
    }
    if (c.get('role') === 'editor') {
      if (existing && ['approved','scheduled'].includes(String(existing.status))) return { error: 'An administrator must edit approved or scheduled activities' };
      if (['approved','scheduled'].includes(String(values.status)) || values.is_public) return { error: 'An administrator must approve, schedule or publish activities' };
    }
  }
  if (area.table === 'committees' && c.get('role') === 'editor') return { error: 'An administrator must change public committee records' };
  if (area.table === 'cms_users') values.email = String(values.email).toLowerCase();
  return { values };
}

admin.post('/:area/:id', async c => {
  const { area: key, id } = c.req.param();
  const area = getArea(c, key);
  if (!area) return c.notFound();
  const base = '/admin/' + key;
  const path = base + '/' + encodeURIComponent(id);
  const db = c.env.DB;
  const row = id === 'new' ? undefined : await find(c, area, id);
  if (id !== 'new' && !row) return c.notFound();

  const reader = c.req.raw.body?.getReader();
  if (!reader) return c.text('A form is required', 400);
  const decoder = new TextDecoder();
  let size = 0;
  let body = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 262144) {
      await reader.cancel();
      return c.text('Form is too large', 413);
    }
    body += decoder.decode(value, { stream: true });
  }
  const data = new URLSearchParams(body + decoder.decode());
  const operation = data.get('operation') ?? 'save';
  if (!['save','preview','publish','archive','restore'].includes(operation)) return c.text('Invalid operation', 400);
  if (['publish','archive','restore'].includes(operation) && c.get('role') !== 'admin') return c.text('Forbidden', 403);
  if (row && data.get('revision') !== String(row.revision)) return c.text('Someone changed this record. Reload it before saving.', 409);
  const actor = c.get('email');
  let statement: D1PreparedStatement;
  if (operation === 'archive' || operation === 'restore') {
    if (!row || data.get('confirm') !== 'yes') return c.text('Confirmation is required', 422);
    if (area.table === 'cms_users' && row.email === actor) return c.text('You cannot archive or restore your own account', 422);
    if ((recordStatus(row) === 'archived') !== (operation === 'restore')) return c.text('Record archive status changed', 409);
    const archived = operation === 'archive' ? 'CURRENT_TIMESTAMP' : 'NULL';
    const restoreStatus = area.table === 'committees' && row.status === 'archived' && operation === 'restore' ? ",status='proposed'" : '';
    // Unpublish archived content and activities so restoration requires an explicit publication.
    const publicFields = operation === 'archive' && area.table === 'content_sections'
      ? ",status='draft',live_title=NULL,live_body=NULL,live_description=NULL,live_order=NULL"
      : operation === 'archive' && area.table === 'activities' ? ',is_public=0' : '';
    statement = db.prepare(`UPDATE ${area.table} SET archived_at=${archived},revision=revision+1,updated_by=?${restoreStatus}${publicFields}
      WHERE id=? AND revision=?`).bind(actor,id,row.revision);
  } else {
    if ((operation === 'preview' || operation === 'publish') && area.table !== 'content_sections') return c.text('Invalid operation', 400);
    if (row && recordStatus(row) === 'archived') return c.text('Restore the record before editing', 409);
    const result = await validate(c, area, data, row ?? undefined);
    if (!result.values) {
      const submitted: Row = Object.fromEntries(area.fields.map(field => [field.key, data.get(field.key)]));
      if (row) submitted.revision = row.revision;
      const form = await renderForm(c, area, path, submitted, Boolean(row));
      const response = page(c, 'Check your changes', `<p role="alert">${E(result.error)}. Check this field or its permissions.</p>${form}`);
      return new Response(response.body, { status: 422, headers: response.headers });
    }
    const values = result.values;
    if (operation === 'preview') {
      return page(c, 'Private preview', section('Private preview', '<p>This preview is visible only to authorized organizers.</p>')
        + renderContent({ title: values.title, description: values.description, body: values.body })
        + section('Continue editing', await renderForm(c, area, path, row ? { ...values, revision: row.revision } : values, Boolean(row))), false);
    }
    if (area.table === 'content_sections') {
      values.status = operation === 'publish' ? 'published' : 'draft';
      if (operation === 'publish') {
        values.live_title = values.title;
        values.live_body = values.body;
        values.live_description = values.description;
        values.live_order = values.display_order;
      }
    }
    if (area.table === 'cms_users' && row?.email === actor) return c.text('You cannot edit your own role', 422);
    values.updated_by = actor;
    const columns = Object.keys(values);
    if (row) {
      const timestamp = ['content_sections','committees','activities','tasks'].includes(area.table) ? ',updated_at=CURRENT_TIMESTAMP' : '';
      statement = db.prepare(`UPDATE ${area.table} SET ${columns.map(column => column + '=?').join(',')},revision=revision+1${timestamp}
        WHERE id=? AND revision=?`).bind(...Object.values(values),id,row.revision);
    } else {
      if (area.table === 'content_sections') values.id = crypto.randomUUID();
      statement = db.prepare(`INSERT INTO ${area.table} (${Object.keys(values).join(',')})
        VALUES (${Object.keys(values).map(() => '?').join(',')})`).bind(...Object.values(values));
    }
  }
  try {
    const result = await statement.run();
    if (result.meta.changes < 1) return c.text('Someone changed this record. Reload it before saving.', 409);
  } catch (error) {
    if (String(error).includes('UNIQUE constraint failed')) return c.text('A record with that name or email already exists. Return to the form to change it.', 409);
    throw error;
  }
  if (c.req.header('HX-Request') === 'true') {
    c.header('HX-Redirect', base + '?saved=1');
    return c.body(null, 204);
  }
  return c.redirect(base + '?saved=1',303);
});
