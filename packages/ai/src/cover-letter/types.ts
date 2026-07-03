import type { ResumeDocument } from "@careerlaunch/domain";

export interface CoverLetterInput {
  resume: ResumeDocument;
  jobDescription?: string;
}

export interface GeneratedCoverLetter {
  body: string;
  salutation?: string;
  closing?: string;
}
