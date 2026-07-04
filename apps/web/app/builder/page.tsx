import { redirect } from "next/navigation";
import { ResumeBuilder } from "./resume-builder";
import { SentryErrorBoundary } from "../../components/sentry-error-boundary";
import { requireUser } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { createStarterResume, fromStoredResume, toStoredResume } from "../../lib/resume-store";
import { can, FeatureKeys } from "../../lib/entitlements";

type BuilderPageProps = {
  searchParams?: Promise<{ resumeId?: string }>;
};

export default async function BuilderPage({ searchParams }: BuilderPageProps) {
  const user = await requireUser();
  const params = searchParams ? await searchParams : {};

  if (!params.resumeId) {
    const allowed = await can(user.id, FeatureKeys.RESUME_LIMIT);
    if (!allowed) {
      redirect("/billing?reason=resume_limit");
    }

    const starter = createStarterResume();
    const created = await prisma.resumeDocument.create({
      data: {
        userId: user.id,
        title: starter.title,
        targetRole: starter.targetRole,
        body: toStoredResume(starter),
        versions: {
          create: {
            body: toStoredResume(starter),
            note: "Initial draft"
          }
        }
      },
      select: { id: true }
    });

    redirect(`/builder?resumeId=${created.id}`);
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
