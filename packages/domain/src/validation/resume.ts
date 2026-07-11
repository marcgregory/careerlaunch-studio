import { z } from "zod";

export const contactSchema = z.object({
  fullName: z.string().min(1, "Full name is required."),
  email: z.string().min(1, "Email is required.").email("Use a valid email address."),
  phone: z.string().min(1, "Phone is required."),
  location: z.string().default(""),
  website: z.string().default(""),
  linkedin: z.string().default(""),
  github: z.string().default(""),
});

export const experienceItemSchema = z.object({
  id: z.string(),
  role: z.string().min(1, "Role is required."),
  company: z.string().min(1, "Company is required."),
  location: z.string().default(""),
  start: z.string().default(""),
  end: z.string().default(""),
  bullets: z.array(z.string()).default([]),
});

export const educationItemSchema = z.object({
  id: z.string(),
  school: z.string().min(1, "School is required."),
  degree: z.string().min(1, "Degree is required."),
  location: z.string().default(""),
  graduation: z.string().default(""),
});

export const referenceItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required."),
  title: z.string().default(""),
  company: z.string().default(""),
  phone: z.string().default(""),
  email: z.string().default(""),
  relationship: z.string().default(""),
});

export const projectItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Project name is required."),
  description: z.string().default(""),
  bullets: z.array(z.string()).default([]),
});

export const summarySchema = z
  .string()
  .refine(
    (val) => val.length === 0 || val.trim().length >= 60,
    "Use at least 60 characters or leave it empty."
  )
  .default("");

export const resumeSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Resume title is required."),
  targetRole: z.string().default(""),
  templateId: z.string().default("modern"),
  contact: contactSchema,
  summary: summarySchema,
  sectionOrder: z.array(z.string()).default([]),
  experience: z.array(experienceItemSchema).default([]),
  education: z.array(educationItemSchema).default([]),
  skills: z.array(z.string()).default([]),
  licenses: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  professionalQualities: z.array(z.string()).default([]),
  projects: z.array(projectItemSchema).default([]),
  volunteer: z.array(experienceItemSchema).default([]),
  references: z.array(referenceItemSchema).default([]),
});

export type ResumeFormValues = z.infer<typeof resumeSchema>;
export type ContactFormValues = z.infer<typeof contactSchema>;
