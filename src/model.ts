type Field = {
  key: string;
  label: string;
  required?: boolean;
  type?: 'textarea' | 'email' | 'date' | 'datetime-local' | 'number';
  max?: number;
  choices?: string[];
  relation?: 'committees' | 'partners';
};

function field(key: string, label: string, options: Omit<Field, 'key' | 'label'> = {}): Field {
  return { key, label, ...options };
}
const required = { required: true };
const paragraph = { type: 'textarea', max: 4000 } as const;
const name = field('name', 'Name', required);
const notes = field('notes', 'Internal notes', paragraph);
const email = field('email', 'Email', { type: 'email' });
const phone = field('phone', 'Phone');
const owner = field('owner', 'Assigned owner');
const followUp = field('follow_up', 'Follow-up date', { type: 'date' });
const committee = field('committee_id', 'Committee', { relation: 'committees' });
const outreach = field('status', 'Outreach status', { choices: ['prospect','contacted','in_discussion','confirmed','declined'] });
const activities = [
  field('name','Activity title',required), field('activity_type','Activity type',{ choices: ['workshop','exhibit','demonstration','presentation','robotics','maker_challenge','STEAM'] }),
  field('category','Category',required), field('description','Description',paragraph), field('presenter','Presenter'),
  field('organization','Organization'), field('location','Location'), field('duration_minutes','Duration in minutes',{ type:'number', max:1440 }),
  field('starts_at','Start date and time (Eastern)',{ type:'datetime-local' }), field('coordinator','Internal coordinator'),
  field('status','Approval status',{ choices:['proposed','review','approved','scheduled','canceled'] }),
  field('is_public','Website visibility',{choices:['0','1']}),
];

export type Area = { title: string; table: string; fields: Field[]; admin?: boolean };
export const areas: Record<string, Area> = {
  content: { title:'Website content', table:'content_sections', fields:[field('title','Title',required),field('description','Description',paragraph),field('body','Content',{...paragraph,...required,max:12000}),field('display_order','Display order',{type:'number',max:100000,required:true})] },
  committees: { title:'Committees',table:'committees',fields:[name,field('lead_name','Chair'),field('cochair','Co-chair'),field('responsibilities','Responsibilities',{...paragraph,...required}),field('deliverable','Deliverables',{...paragraph,...required}),field('progress','Progress',paragraph),field('status','Status',{choices:['proposed','active']})] },
  members: { title:'Committee members',table:'committee_members',fields:[{...committee,...required},name,field('responsibilities','Responsibilities',paragraph)] },
  activities: { title:'Programming',table:'activities',fields:activities },
  schedule: { title:'Event schedule',table:'activities',fields:activities },
  partners: { title:'Partners',table:'partners',fields:[name,field('category','Organization type',{choices:['school','college_or_university','makerspace','community','STEM_or_STEAM','4-H_or_youth','other']}),field('website','Website'),owner,outreach,notes,followUp] },
  contacts: { title:'Partner contacts',table:'partner_contacts',fields:[field('partner_id','Partner organization',{relation:'partners',required:true}),name,field('position','Position'),email,phone,notes] },
  sponsors: { title:'Sponsors',table:'sponsors',fields:[name,field('contact','Contact'),email,field('category','Sponsorship category',required),field('contribution_type','Contribution type',{choices:['financial','in_kind','mixed']}),field('contribution','Contribution details',paragraph),field('value_cents','Value in US cents',{type:'number',max:1000000000}),field('value_status','Value status',{choices:['estimated','confirmed']}),outreach,followUp,field('owner','Assigned committee member'),notes] },
  tasks: { title:'Tasks',table:'tasks',fields:[field('title','Task title',required),field('description','Description',paragraph),owner,committee,field('due_date','Deadline',{type:'date'}),field('status','Status',{choices:['not_started','in_progress','blocked','review','completed']})] },
  volunteers: { title:'Volunteers',table:'volunteers',fields:[name,email,phone,field('availability','Availability',paragraph),field('assignment','Assignment'),committee,field('status','Participation status',{choices:['interested','confirmed','assigned','completed','withdrawn']})] },
  access: { title:'CMS access',table:'cms_users',admin:true,fields:[{...email,...required},field('role','Role',{choices:['editor','admin']})] },
};

export function choiceLabel(value: string) {
  if (value === '0') return 'Private';
  if (value === '1') return 'Public when scheduled';
  return value.replaceAll('_', ' ');
}
