ALTER TABLE content_sections ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE content_sections ADD COLUMN live_title TEXT;
ALTER TABLE content_sections ADD COLUMN live_body TEXT;
ALTER TABLE content_sections ADD COLUMN live_description TEXT;
ALTER TABLE content_sections ADD COLUMN live_order INTEGER;
UPDATE content_sections SET live_title=title,live_body=body,live_description=description,live_order=display_order WHERE status='published';
ALTER TABLE committees ADD COLUMN cochair TEXT;
ALTER TABLE committees ADD COLUMN progress TEXT;
ALTER TABLE activities ADD COLUMN activity_type TEXT;
ALTER TABLE activities ADD COLUMN presenter TEXT;
ALTER TABLE activities ADD COLUMN location TEXT;
ALTER TABLE activities ADD COLUMN starts_at TEXT;
ALTER TABLE activities ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0 CHECK(is_public IN (0,1));
ALTER TABLE tasks ADD COLUMN description TEXT;
CREATE TABLE committee_members (id INTEGER PRIMARY KEY, committee_id INTEGER NOT NULL REFERENCES committees(id), name TEXT NOT NULL, responsibilities TEXT);
CREATE TABLE partners (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, website TEXT, owner TEXT, status TEXT NOT NULL, notes TEXT, follow_up TEXT);
CREATE TABLE partner_contacts (id INTEGER PRIMARY KEY, partner_id INTEGER NOT NULL REFERENCES partners(id), name TEXT NOT NULL, position TEXT, email TEXT, phone TEXT, notes TEXT);
CREATE TABLE sponsors (id INTEGER PRIMARY KEY, name TEXT NOT NULL, contact TEXT, email TEXT, category TEXT NOT NULL, contribution_type TEXT NOT NULL, contribution TEXT, value_cents INTEGER CHECK(value_cents >= 0), value_status TEXT NOT NULL, status TEXT NOT NULL, follow_up TEXT, owner TEXT, notes TEXT);
CREATE TABLE volunteers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT, availability TEXT, assignment TEXT, committee_id INTEGER REFERENCES committees(id), status TEXT NOT NULL);
CREATE TABLE cms_users (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, role TEXT NOT NULL CHECK(role IN ('admin','editor')));

ALTER TABLE content_sections ADD COLUMN archived_at TEXT;
ALTER TABLE content_sections ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
CREATE TRIGGER cms_content_sections_insert AFTER INSERT ON content_sections
WHEN NEW.updated_by IS NOT NULL
BEGIN
  INSERT INTO audit_log(actor,action,record_type,record_id) VALUES(NEW.updated_by,'create','content_sections',NEW.id);
END;
CREATE TRIGGER cms_content_sections_update AFTER UPDATE ON content_sections
WHEN OLD.revision <> NEW.revision
BEGIN
  INSERT INTO audit_log(actor,action,record_type,record_id)
    VALUES(NEW.updated_by,CASE WHEN OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN 'archive'
      WHEN OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN 'restore' ELSE 'update' END,'content_sections',NEW.id);
END;

ALTER TABLE committees ADD COLUMN archived_at TEXT;
ALTER TABLE committees ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE committees ADD COLUMN updated_by TEXT;
CREATE TRIGGER cms_committees_insert AFTER INSERT ON committees
WHEN NEW.updated_by IS NOT NULL
BEGIN
  INSERT INTO audit_log(actor,action,record_type,record_id) VALUES(NEW.updated_by,'create','committees',NEW.id);
END;
CREATE TRIGGER cms_committees_update AFTER UPDATE ON committees
WHEN OLD.revision <> NEW.revision
BEGIN
  INSERT INTO audit_log(actor,action,record_type,record_id)
    VALUES(NEW.updated_by,CASE WHEN OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN 'archive'
      WHEN OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN 'restore' ELSE 'update' END,'committees',NEW.id);
END;

ALTER TABLE activities ADD COLUMN archived_at TEXT;
ALTER TABLE activities ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE activities ADD COLUMN updated_by TEXT;
CREATE TRIGGER cms_activities_insert AFTER INSERT ON activities
WHEN NEW.updated_by IS NOT NULL
BEGIN
  INSERT INTO audit_log(actor,action,record_type,record_id) VALUES(NEW.updated_by,'create','activities',NEW.id);
END;
CREATE TRIGGER cms_activities_update AFTER UPDATE ON activities
WHEN OLD.revision <> NEW.revision
BEGIN
  INSERT INTO audit_log(actor,action,record_type,record_id)
    VALUES(NEW.updated_by,CASE WHEN OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN 'archive'
      WHEN OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN 'restore' ELSE 'update' END,'activities',NEW.id);
END;

ALTER TABLE tasks ADD COLUMN archived_at TEXT;
ALTER TABLE tasks ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN updated_by TEXT;
CREATE TRIGGER cms_tasks_insert AFTER INSERT ON tasks
WHEN NEW.updated_by IS NOT NULL
BEGIN
  INSERT INTO audit_log(actor,action,record_type,record_id) VALUES(NEW.updated_by,'create','tasks',NEW.id);
END;
CREATE TRIGGER cms_tasks_update AFTER UPDATE ON tasks
WHEN OLD.revision <> NEW.revision
BEGIN
  INSERT INTO audit_log(actor,action,record_type,record_id)
    VALUES(NEW.updated_by,CASE WHEN OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN 'archive'
      WHEN OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN 'restore' ELSE 'update' END,'tasks',NEW.id);
END;

ALTER TABLE committee_members ADD COLUMN archived_at TEXT;
ALTER TABLE committee_members ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE committee_members ADD COLUMN updated_by TEXT;
CREATE TRIGGER cms_committee_members_insert AFTER INSERT ON committee_members
WHEN NEW.updated_by IS NOT NULL
BEGIN
  INSERT INTO audit_log(actor,action,record_type,record_id) VALUES(NEW.updated_by,'create','committee_members',NEW.id);
END;
CREATE TRIGGER cms_committee_members_update AFTER UPDATE ON committee_members
WHEN OLD.revision <> NEW.revision
BEGIN
  INSERT INTO audit_log(actor,action,record_type,record_id)
    VALUES(NEW.updated_by,CASE WHEN OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN 'archive'
      WHEN OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN 'restore' ELSE 'update' END,'committee_members',NEW.id);
END;

ALTER TABLE partners ADD COLUMN archived_at TEXT;
ALTER TABLE partners ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE partners ADD COLUMN updated_by TEXT;
CREATE TRIGGER cms_partners_insert AFTER INSERT ON partners
WHEN NEW.updated_by IS NOT NULL
BEGIN
  INSERT INTO audit_log(actor,action,record_type,record_id) VALUES(NEW.updated_by,'create','partners',NEW.id);
END;
CREATE TRIGGER cms_partners_update AFTER UPDATE ON partners
WHEN OLD.revision <> NEW.revision
BEGIN
  INSERT INTO audit_log(actor,action,record_type,record_id)
    VALUES(NEW.updated_by,CASE WHEN OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN 'archive'
      WHEN OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN 'restore' ELSE 'update' END,'partners',NEW.id);
END;

ALTER TABLE partner_contacts ADD COLUMN archived_at TEXT;
ALTER TABLE partner_contacts ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE partner_contacts ADD COLUMN updated_by TEXT;
CREATE TRIGGER cms_partner_contacts_insert AFTER INSERT ON partner_contacts
WHEN NEW.updated_by IS NOT NULL
BEGIN
  INSERT INTO audit_log(actor,action,record_type,record_id) VALUES(NEW.updated_by,'create','partner_contacts',NEW.id);
END;
CREATE TRIGGER cms_partner_contacts_update AFTER UPDATE ON partner_contacts
WHEN OLD.revision <> NEW.revision
BEGIN
  INSERT INTO audit_log(actor,action,record_type,record_id)
    VALUES(NEW.updated_by,CASE WHEN OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN 'archive'
      WHEN OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN 'restore' ELSE 'update' END,'partner_contacts',NEW.id);
END;

ALTER TABLE sponsors ADD COLUMN archived_at TEXT;
ALTER TABLE sponsors ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sponsors ADD COLUMN updated_by TEXT;
CREATE TRIGGER cms_sponsors_insert AFTER INSERT ON sponsors
WHEN NEW.updated_by IS NOT NULL
BEGIN
  INSERT INTO audit_log(actor,action,record_type,record_id) VALUES(NEW.updated_by,'create','sponsors',NEW.id);
END;
CREATE TRIGGER cms_sponsors_update AFTER UPDATE ON sponsors
WHEN OLD.revision <> NEW.revision
BEGIN
  INSERT INTO audit_log(actor,action,record_type,record_id)
    VALUES(NEW.updated_by,CASE WHEN OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN 'archive'
      WHEN OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN 'restore' ELSE 'update' END,'sponsors',NEW.id);
END;

ALTER TABLE volunteers ADD COLUMN archived_at TEXT;
ALTER TABLE volunteers ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE volunteers ADD COLUMN updated_by TEXT;
CREATE TRIGGER cms_volunteers_insert AFTER INSERT ON volunteers
WHEN NEW.updated_by IS NOT NULL
BEGIN
  INSERT INTO audit_log(actor,action,record_type,record_id) VALUES(NEW.updated_by,'create','volunteers',NEW.id);
END;
CREATE TRIGGER cms_volunteers_update AFTER UPDATE ON volunteers
WHEN OLD.revision <> NEW.revision
BEGIN
  INSERT INTO audit_log(actor,action,record_type,record_id)
    VALUES(NEW.updated_by,CASE WHEN OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN 'archive'
      WHEN OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN 'restore' ELSE 'update' END,'volunteers',NEW.id);
END;

ALTER TABLE cms_users ADD COLUMN archived_at TEXT;
ALTER TABLE cms_users ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cms_users ADD COLUMN updated_by TEXT;
CREATE TRIGGER cms_cms_users_insert AFTER INSERT ON cms_users
WHEN NEW.updated_by IS NOT NULL
BEGIN
  INSERT INTO audit_log(actor,action,record_type,record_id) VALUES(NEW.updated_by,'create','cms_users',NEW.id);
END;
CREATE TRIGGER cms_cms_users_update AFTER UPDATE ON cms_users
WHEN OLD.revision <> NEW.revision
BEGIN
  INSERT INTO audit_log(actor,action,record_type,record_id)
    VALUES(NEW.updated_by,CASE WHEN OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN 'archive'
      WHEN OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN 'restore' ELSE 'update' END,'cms_users',NEW.id);
END;

CREATE INDEX cms_schedule ON activities(starts_at) WHERE is_public=1 AND status='scheduled' AND archived_at IS NULL;

-- Move the original overview copy into editable records.
INSERT INTO content_sections(id,title,body,status,display_order,live_title,live_body,live_order)
VALUES
 ('home-hero','Let''s build something remarkable. Together.','A community-powered celebration of making and STEAM discovery.','published',0,
  'Let''s build something remarkable. Together.','A community-powered celebration of making and STEAM discovery.',0),
 ('home-priorities','Our priorities','🤝 Organize — Build a collaborative committee with clear ownership.
🛠️ Create — Recruit makers and develop interactive workshops.
📅 Plan — Track activities, venue requirements and milestones.','published',10,'Our priorities',
  '🤝 Organize — Build a collaborative committee with clear ownership.
🛠️ Create — Recruit makers and develop interactive workshops.
📅 Plan — Track activities, venue requirements and milestones.',10),
 ('home-plan','Plan for the next 90 days','Founding team — Agree on leadership and recruit workstream chairs.
Develop program — Approach educators, maker groups and sponsors.
Get event-ready — Confirm requirements, approvals and commitments.','published',20,'Plan for the next 90 days',
  'Founding team — Agree on leadership and recruit workstream chairs.
Develop program — Approach educators, maker groups and sponsors.
Get event-ready — Confirm requirements, approvals and commitments.',20);
