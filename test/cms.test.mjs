import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import app from '../dist/maker_fest_planning_hub_v2_staging/index.js';

test('CMS publishing, roles, CRUD, archive, audit and public data boundaries', async () => {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys=ON');
  for (const migration of ['0001_initial.sql', '0002_cms.sql']) {
    sql.exec(readFileSync(new URL('../migrations/' + migration, import.meta.url), 'utf8'));
  }
  assert.equal(sql.prepare('SELECT count(*) AS count FROM committees').get().count, 8);
  assert.equal(sql.prepare('SELECT count(*) AS count FROM activities').get().count, 5);

  function prepare(query, args = []) {
    return {
      bind: (...values) => prepare(query, values),
      first: async () => sql.prepare(query).get(...args) ?? null,
      all: async () => ({ results: sql.prepare(query).all(...args) }),
      run: async () => ({ meta: sql.prepare(query).run(...args) }),
    };
  }
  const domain = 'https://test.cloudflareaccess.com';
  const host = 'https://maker.test';
  const audience = 'cms-test';
  const env = { DB: { prepare }, ACCESS_TEAM_DOMAIN: domain, ACCESS_AUD: audience };
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const key = await exportJWK(publicKey);
  key.kid = 'test-key';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request) => {
    assert.equal(String(request), domain + '/cdn-cgi/access/certs');
    return Response.json({ keys: [key] });
  };
  async function jwt(email, aud = audience, expiration = '5m') {
    return new SignJWT({ email }).setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(domain).setAudience(aud).setExpirationTime(expiration).sign(privateKey);
  }
  try {
    const admin = await jwt('admin@example.com');
    const editor = await jwt('editor@example.com');
    const other = await jwt('other@example.com');
    sql.exec("INSERT INTO cms_users(email,role) VALUES('admin@example.com','admin'),('editor@example.com','editor')");
    const get = (path, token) => app.request(host + path, token ? { headers: { 'Cf-Access-Jwt-Assertion': token } } : {}, env);
    const post = (path, values, token = admin, origin = host) => app.request(host + path, {
      method: 'POST',
      headers: { Origin: origin, 'Cf-Access-Jwt-Assertion': token },
      body: new URLSearchParams(values),
    }, env);
    assert.equal((await get('/admin')).status, 401);
    assert.equal((await get('/admin/')).status, 401);
    assert.equal((await get('/admin/tasks', 'invalid')).status, 401);
    assert.equal((await get('/admin/tasks', await jwt('admin@example.com', 'wrong'))).status, 401);
    assert.equal((await get('/admin/tasks', await jwt('admin@example.com', audience, '1s ago'))).status, 401);
    assert.equal((await get('/admin/tasks', other)).status, 403);
    assert.equal((await get('/admin/audit', editor)).status, 403);
    assert.equal((await get('/admin/access', editor)).status, 404);
    const privatePage = await get('/admin', admin);
    assert.equal(privatePage.status, 200);
    assert.match(privatePage.headers.get('Cache-Control'), /no-store/);
    assert.equal((await post('/admin/tasks/new', {}, admin, 'https://unrelated.test')).status, 403);

    const draft = { title: '<script>draft</script>', description: 'Draft summary', body: 'Draft body', display_order: '50' };
    const preview = await post('/admin/content/new', { ...draft, operation: 'preview' }, editor);
    assert.match(await preview.text(), /&lt;script&gt;draft&lt;\/script&gt;/);
    assert.equal((await post('/admin/content/new', { ...draft, operation: 'publish' }, editor)).status, 403);
    assert.equal((await post('/admin/content/new', draft, editor)).status, 303);
    assert.doesNotMatch(await (await get('/')).text(), /Draft body/);
    const content = sql.prepare('SELECT id FROM content_sections WHERE title=?').get(draft.title);
    const path = '/admin/content/' + content.id;
    assert.equal((await post(path, { ...draft, operation: 'publish', revision: '0' })).status, 303);
    assert.match(await (await get('/')).text(), /Draft body/);
    assert.equal((await post(path, { ...draft, body: 'Unpublished edit', revision: '1' }, editor)).status, 303);
    assert.doesNotMatch(await (await get('/')).text(), /Unpublished edit/);
    assert.equal((await post(path, { ...draft, revision: '1' })).status, 409);
    assert.equal((await post(path, { operation: 'archive', revision: '2' })).status, 422);
    assert.equal((await post(path, { operation: 'archive', revision: '2', confirm: 'yes' })).status, 303);
    assert.doesNotMatch(await (await get('/')).text(), /Draft body/);

    const samples = [
      ['committees', 'committees', { name:'Test committee',lead_name:'Chair',cochair:'Co-chair',responsibilities:'Plan',deliverable:'Agenda',progress:'Started',status:'active' }],
      ['members', 'committee_members', { committee_id:'1', name:'Test member', responsibilities:'Plan' }],
      ['partners', 'partners', { name:'Test partner',category:'school',website:'',owner:'',status:'prospect',notes:'Private notes',follow_up:'2027-01-01' }],
      ['contacts', 'partner_contacts', { partner_id:'1',name:'Test contact',position:'',email:'private@example.com',phone:'',notes:'Private notes' }],
      ['sponsors', 'sponsors', { name:'Test sponsor',contact:'',email:'',category:'Gold',contribution_type:'financial',contribution:'',value_cents:'12000',value_status:'estimated',status:'prospect',follow_up:'',owner:'',notes:'Private notes' }],
      ['volunteers', 'volunteers', { name:'Test volunteer',email:'private@example.com',phone:'',availability:'Sunday',assignment:'',committee_id:'1',status:'interested' }],
      ['tasks', 'tasks', { title:'Test task',description:'',owner:'Test member',committee_id:'1',due_date:'2027-05-01',status:'blocked' }],
    ];
    for (const [area, table, fields] of samples) {
      const base = '/admin/' + area;
      assert.equal((await post(base + '/new', fields)).status, 303, area + ' create');
      const item = sql.prepare('SELECT id FROM ' + table + ' ORDER BY id DESC LIMIT 1').get();
      assert.equal((await get(base + '/' + item.id, admin)).status, 200, area + ' read');
      assert.equal((await post(base + '/' + item.id, { ...fields, revision:'0' })).status, 303, area + ' update');
      assert.equal((await post(base + '/' + item.id, { operation:'archive',revision:'1',confirm:'yes' })).status, 303, area + ' archive');
      assert.equal((await post(base + '/' + item.id, { operation:'restore',revision:'2',confirm:'yes' })).status, 303, area + ' restore');
    }
    assert.match(await (await get('/admin/tasks?status=blocked', admin)).text(), /Test task/);
    assert.doesNotMatch(await (await get('/admin/tasks?status=completed', admin)).text(), /Test task/);
    const activity = { name:'Test workshop',activity_type:'workshop',category:'Making',description:'Public description',
      presenter:'Presenter',organization:'Maker group',location:'Hall A',duration_minutes:'30',starts_at:'2027-05-01T09:00',
      coordinator:'Private coordinator',status:'scheduled',is_public:'1' };
    assert.equal((await post('/admin/activities/new', activity, editor)).status, 422);
    assert.equal((await post('/admin/activities/new', { ...activity,status:'approved' })).status, 303);
    assert.doesNotMatch(await (await get('/schedule')).text(), /Test workshop/);
    const scheduled = sql.prepare('SELECT id FROM activities WHERE name=?').get(activity.name);
    assert.equal((await post('/admin/schedule/' + scheduled.id, { ...activity,revision:'0' })).status, 303);
    for (const route of ['/programming','/schedule']) {
      const html = await (await get(route)).text();
      assert.match(html, /Test workshop/);
      assert.doesNotMatch(html, /Private coordinator|Robotics &amp; Engineering|private@example.com/);
    }
    assert.equal((await post('/admin/schedule/' + scheduled.id, { ...activity,status:'canceled',revision:'1' })).status, 303);
    assert.doesNotMatch(await (await get('/schedule')).text(), /Test workshop/);
    assert.equal(sql.prepare("SELECT count(*) AS count FROM audit_log WHERE action='archive'").get().count, 8);
    assert.match(await (await get('/admin/audit', admin)).text(), /admin@example.com/);
  } finally {
    globalThis.fetch = originalFetch;
    sql.close();
  }
});
