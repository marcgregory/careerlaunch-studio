export type ResumeDocument = {
  id: string;
  title: string;
  targetRole: string;
  templateId: ResumeTemplateId;
  contact: ContactInfo;
  summary: string;
  sectionOrder: ResumeSectionId[];
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: string[];
  projects: ProjectItem[];
  certifications: string[];
  licenses: LicenseItem[];
  volunteer: ExperienceItem[];
  achievements: string[];
  languages: string[];
  references: ReferenceItem[];
  awards: string[];
  memberships: string[];
  publications: string[];
  training: string[];
  /** Legacy alias retained for old stored resumes and fixture compatibility. */
  professionalQualities: string[];
};

export type ResumeTemplateId = 'modern' | 'executive' | 'minimal' | 'ats';

export type ResumeSectionId =
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'
  | 'licenses'
  | 'volunteer'
  | 'achievements'
  | 'languages'
  | 'references'
  | 'awards'
  | 'memberships'
  | 'publications'
  | 'training'
  | 'professionalQualities';

export const defaultSectionOrder: ResumeSectionId[] = [
  'summary',
  'experience',
  'education',
  'skills',
  'projects',
  'certifications',
  'licenses',
  'volunteer',
  'achievements',
  'professionalQualities',
  'awards',
  'languages',
  'memberships',
  'publications',
  'training',
  'references'
];

export type ContactInfo = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  linkedin: string;
  github: string;
};

export type ReferenceItem = {
  id: string;
  name: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  relationship: string;
};

export type ExperienceItem = {
  id: string;
  role: string;
  company: string;
  location: string;
  start: string;
  end: string;
  bullets: string[];
};

export type EducationItem = {
  id: string;
  school: string;
  degree: string;
  location: string;
  graduation: string;
  gpa?: string;
  honors?: string[];
};

export type ProjectItem = {
  id: string;
  name: string;
  description: string;
  technologies?: string[];
  bullets: string[];
};

export type LicenseItem = {
  id: string;
  name: string;
  issuingAuthority: string;
  licenseNumber: string;
  expirationDate: string;
};

export type ResumeCheck = {
  score: number;
  checks: ResumeCheckItem[];
};

export type CoverLetterDocument = {
  id: string;
  resumeId: string;
  title: string;
  recipientName: string;
  recipientTitle: string;
  companyName: string;
  companyAddress: string;
  salutation: string;
  body: string;
  closing: string;
  signatureName: string;
  jobDescription: string;
};

export type ResumeCheckItem = {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
};

export * from './entitlements/types';
export * from './entitlements/plans';

export * from './validation/auth';
export * from './validation/resume';
export { validateResumeWithSchema } from './validation/validate-resume';

export const sampleResume: ResumeDocument = {
  id: 'sample-resume',
  title: 'Career Switch Resume',
  targetRole: 'Customer Success Manager',
  templateId: 'modern',
  contact: {
    fullName: 'Jordan Lee',
    email: 'jordan.lee@email.com',
    phone: '555 014-7291',
    location: 'Austin TX',
    website: '',
    linkedin: 'linkedin.com/in/jordanlee',
    github: ''
  },
  summary:
    'Customer-focused operations specialist with 6 years of experience improving service workflows training frontline teams and translating customer feedback into measurable retention gains.',
  sectionOrder: defaultSectionOrder,
  experience: [
    {
      id: 'exp-1',
      role: 'Operations Lead',
      company: 'Northstar Market',
      location: 'Austin TX',
      start: '2021',
      end: 'Present',
      bullets: [
        'Improved weekly customer issue resolution time by 28% by redesigning escalation playbooks.',
        'Trained 18 team members on service recovery CRM notes and customer follow-up standards.',
        'Partnered with managers to analyze feedback trends and reduce repeat complaints by 19%.'
      ]
    },
    {
      id: 'exp-2',
      role: 'Retail Supervisor',
      company: 'Harbor Outfitters',
      location: 'San Antonio TX',
      start: '2018',
      end: '2021',
      bullets: [
        'Managed daily service operations for a team of 12 across high-volume weekend shifts.',
        'Created onboarding checklists that reduced new-hire ramp time by two weeks.'
      ]
    }
  ],
  education: [
    {
      id: 'edu-1',
      school: 'Texas State University',
      degree: 'B.A. Communication Studies',
      location: 'San Marcos TX',
      graduation: '2018',
      honors: []
    }
  ],
  skills: [
    'Customer onboarding',
    'CRM documentation',
    'Process improvement',
    'Team training',
    'Retention analysis',
    'Conflict resolution'
  ],
  projects: [
    {
      id: 'proj-1',
      name: 'Service Recovery Playbook',
      description: 'Internal guide for consistent customer follow-up after escalations.',
      technologies: [],
      bullets: ['Standardized response timing ownership rules and outcome tracking for managers.']
    }
  ],
  certifications: ['HubSpot Customer Success Certificate'],
  licenses: [],
  volunteer: [],
  achievements: [],
  languages: [],
  references: [],
  awards: [],
  memberships: [],
  publications: [],
  training: [],
  professionalQualities: []
};

export function scoreResume(resume: ResumeDocument): ResumeCheck {
  const checks: ResumeCheckItem[] = [
    {
      id: 'contact',
      label: 'Contact details',
      status:
        resume.contact.fullName && resume.contact.email && resume.contact.phone
          ? 'pass'
          : 'fail',
      detail: 'Include name email and phone so recruiters can respond quickly.'
    },
    {
      id: 'summary',
      label: 'Focused summary',
      status: resume.summary.length >= 120 ? 'pass' : resume.summary.length >= 60 ? 'warn' : 'fail',
      detail: 'Use a 2-3 sentence summary connected to the target role.'
    },
    {
      id: 'experience',
      label: 'Recent experience',
      status: resume.experience.length >= 2 ? 'pass' : resume.experience.length === 1 ? 'warn' : 'fail',
      detail: 'Add at least two relevant roles or one role plus a strong project.'
    },
    {
      id: 'metrics',
      label: 'Measurable impact',
      status: countMetricBullets(resume) >= 2 ? 'pass' : countMetricBullets(resume) === 1 ? 'warn' : 'fail',
      detail: 'Use numbers percentages time saved revenue volume or team size where possible.'
    },
    {
      id: 'skills',
      label: 'Role-ready skills',
      status: resume.skills.length >= 6 ? 'pass' : resume.skills.length >= 3 ? 'warn' : 'fail',
      detail: 'List 6-10 skills that match the job description and your evidence.'
    },
    {
      id: 'length',
      label: 'Readable length',
      status: estimateWordCount(resume) <= 650 ? 'pass' : 'warn',
      detail: 'Keep the first version tight enough for a one-page resume.'
    }
  ];

  const points = checks.reduce((total, check) => {
    if (check.status === 'pass') return total + 100;
    if (check.status === 'warn') return total + 65;
    return total + 25;
  }, 0);

  return {
    score: Math.round(points / checks.length),
    checks
  };
}

export function estimateWordCount(resume: ResumeDocument): number {
  const achievementItems = resume.achievements.length > 0 ? resume.achievements : resume.professionalQualities;
  const content = [
    resume.summary,
    ...resume.experience.flatMap((item) => [item.role, item.company, ...item.bullets]),
    ...resume.education.flatMap((item) => [item.school, item.degree, item.gpa ?? '', ...(item.honors ?? [])]),
    ...resume.skills,
    ...resume.projects.flatMap((item) => [item.name, item.description, ...(item.technologies ?? []), ...item.bullets]),
    ...resume.certifications,
    ...resume.licenses.flatMap((item) => [item.name, item.issuingAuthority, item.licenseNumber, item.expirationDate]),
    ...resume.volunteer.flatMap((item) => [item.role, item.company, ...item.bullets]),
    ...achievementItems,
    ...resume.languages,
    ...resume.awards,
    ...resume.memberships,
    ...resume.publications,
    ...resume.training,
    ...resume.references.flatMap((item) => [item.name, item.title, item.company, item.phone, item.email, item.relationship])
  ].join(' ');

  return content.split(/\s+/).filter(Boolean).length;
}

function countMetricBullets(resume: ResumeDocument): number {
  return resume.experience
    .flatMap((item) => item.bullets)
    .filter((bullet) => /\d|%|\$|million|thousand|hours|weeks|months/i.test(bullet)).length;
}