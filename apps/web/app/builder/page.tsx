import { redirect } from "next/navigation";
import { ResumeBuilder } from "./resume-builder";
import { SentryErrorBoundary } from "../../components/sentry-error-boundary";
import { requireUser } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { fromStoredResume } from "../../lib/resume-store";
import { can, FeatureKeys } from "../../lib/entitlements";

type BuilderPageProps = {
  searchParams?: Promise<{ resumeId?: string }>;
};

/**
 * /builder — load-only.
 *
 * Resume creation was moved out of this route. The dashboard "New resume"
 * button now POSTs /api/resumes (kind: "starter") and router.pushes the user
 * here with a real resumeId. This page is therefore one responsibility:
 * load an existing resume and hand it to the client editor.
 *
 * Direct hits to `/builder` without a resumeId redirect to the dashboard so
 * the user lands somewhere useful (their resume list) instead of an empty
 * editor. Bookmarks and external links still work — anonymous users land on
 * /login via the existing requireUser() gate.
 */
export default async function BuilderPage({ searchParams }: BuilderPageProps) {
  const user = await requireUser();
  const params = searchParams ? await searchParams : {};

  if (!params.resumeId) {
    redirect("/dashboard");
  }

  const resume = await prisma.resumeDocument.findFirst({
    where: { id: params.resumeId, userId: user.id }
  });

  if (!resume) redirect("/dashboard");

  const canUsePremiumTemplates = await can(user.id, FeatureKeys.USE_PREMIUM_TEMPLATES);

  return (
    <SentryErrorBoundary context={{ resumeId: params.resumeId }}>
      <ResumeBuilder initialResume={fromStoredResume(resume)} canUsePremiumTemplates={canUsePremiumTemplates} />
    </SentryErrorBoundary>
  );
}