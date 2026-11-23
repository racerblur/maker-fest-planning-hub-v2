CREATE TABLE IF NOT EXISTS content_sections (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
  display_order INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS committees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  responsibilities TEXT NOT NULL,
  deliverable TEXT NOT NULL,
  lead_name TEXT,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','active','archived')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  organization TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','review','approved','scheduled','canceled')),
  coordinator TEXT,
  duration_minutes INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  owner TEXT,
  committee_id INTEGER REFERENCES committees(id),
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK(status IN ('not_started','in_progress','blocked','review','completed')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  record_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO content_sections(id,title,body,status,display_order) VALUES
 ('vision','Vision','A community-driven festival celebrating learning, making and STEAM discovery.','published',1),
 ('invitation','Join the organizing team','Bring your ideas, experience and connections to help make Middlesex County Maker Fest possible.','published',2);
INSERT OR IGNORE INTO committees(name,responsibilities,deliverable) VALUES
 ('Steering Committee','Vision, budget, approvals, major partnerships','Decision charter'),
 ('Programming & Activities','Workshops, exhibits, demonstrations, event schedule','Programming inventory'),
 ('Sponsorship & Fundraising','Sponsorships, donations, grants and in-kind support','Sponsor prospectus'),
 ('Education & Outreach','Schools, colleges, youth groups and 4-H','Outreach plan'),
 ('Makerspace Relations','Makerspace network, maker recruitment, shared equipment and collaboration','Makerspace outreach pipeline'),
 ('Marketing & Communications','Website, branding, social media and press','Communications calendar'),
 ('Operations & Logistics','Venue, capacity, accessibility, safety and equipment','Logistics checklist'),
 ('Volunteers & Hospitality','Volunteer recruitment, staffing, check-in and visitor experience','Staffing plan');
INSERT INTO activities(name,category,description,status) VALUES
 ('Robotics & Engineering','Robotics','Student robots, engineering demonstrations and potential robot challenges','proposed'),
 ('Making & Fabrication','Making','3D printing, electronics and build workshops','proposed'),
 ('Science & Discovery','Science','Hands-on science and sustainability exhibits','proposed'),
 ('Arts, Media & Design','Creative STEAM','Stop-motion, filmmaking, game design and digital arts','proposed'),
 ('Young Makers & Families','Family','Welcoming activities for youth groups and families','proposed');
