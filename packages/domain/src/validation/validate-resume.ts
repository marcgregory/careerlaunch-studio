import { z } from "zod";
import { resumeSchema, contactSchema, experienceItemSchema, educationItemSchema, projectItemSchema, summarySchema } from "./resume";
import type { ResumeDocument, ExperienceItem, EducationItem, ProjectItem } from "../index";

export function validateResumeWithSchema(
  resume: ResumeDocument
): Partial<Record<string, string>> {
  const errors: Partial<Record<string, string>> = {};

  // Validate contact fields
  const contactResult = contactSchema.safeParse(resume.contact);
  if (!contactResult.success) {
    for (const issue of contactResult.error.issues) {
      const field = issue.path.join(".");
      if (field === "fullName") errors.fullName = issue.message;
      if (field === "email") errors.email = issue.message;
      if (field === "phone") errors.phone = issue.message;
    }
  }

  // Validate title
  if (!resume.title.trim()) {
    errors.title = "Resume title is required.";
  }

  // Validate summary
  const summaryResult = summarySchema.safeParse(resume.summary);
  if (!summaryResult.success) {
    errors.summary = summaryResult.error.issues[0]?.message ?? "Use at least 60 characters or leave it empty.";
  }

  // Validate experience items
  resume.experience.forEach((item) => {
    const result = experienceItemSchema.safeParse(item);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = `experience.${item.id}.${issue.path.join(".")}`;
        if (issue.path.join(".") === "role" || issue.path.join(".") === "company") {
          errors[key] = issue.message;
        }
      }
    }
  });

  // Validate education items
  resume.education.forEach((item) => {
    const result = educationItemSchema.safeParse(item);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = `education.${item.id}.${issue.path.join(".")}`;
        if (issue.path.join(".") === "school" || issue.path.join(".") === "degree") {
          errors[key] = issue.message;
        }
      }
    }
  });

  // Validate project items
  resume.projects.forEach((item) => {
    const result = projectItemSchema.safeParse(item);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = `project.${item.id}.${issue.path.join(".")}`;
        if (issue.path.join(".") === "name") {
          errors[key] = issue.message;
        }
      }
    }
  });

  return errors;
}
