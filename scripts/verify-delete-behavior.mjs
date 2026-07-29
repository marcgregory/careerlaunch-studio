import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Find a user with a resume and ExportJob rows, or create one.
const user = await prisma.user.findFirst({
  include: { resumes: { include: { exports: true } } },
});

if (!user) {
  console.log("No user found in local DB. Aborting.");
  process.exit(1);
}

const resume = user.resumes.find((r) => r.exports.length > 0);

if (!resume) {
  console.log("No resume with ExportJob rows found. Aborting.");
  console.log("User:", user.id);
  console.log("Resumes:", user.resumes.map((r) => ({ id: r.id, exports: r.exports.length })));
  process.exit(1);
}

console.log(`Found user ${user.id} with resume ${resume.id}`);
console.log(`Resume has ${resume.exports.length} ExportJob rows.`);

const exportCountBefore = await prisma.exportJob.count({
  where: { userId: user.id, format: "PDF" },
});
console.log(`ExportJob.count for user (PDF, all-time): ${exportCountBefore}`);

// Try to delete the resume. This is the operation that was failing in prod.
try {
  await prisma.resumeDocument.delete({ where: { id: resume.id } });
  console.log("✅ Resume deleted successfully.");
} catch (err) {
  console.log("❌ Resume delete failed:");
  console.log(err.message);
  process.exit(1);
}

// Check ExportJob rows survived
const exportCountAfter = await prisma.exportJob.count({
  where: { userId: user.id, format: "PDF" },
});
console.log(`ExportJob.count for user (PDF, all-time) AFTER delete: ${exportCountAfter}`);

if (exportCountBefore === exportCountAfter) {
  console.log("✅ ExportJob rows survived delete (SET NULL working).");
} else {
  console.log(`❌ ExportJob count changed: ${exportCountBefore} -> ${exportCountAfter}`);
}

const orphanRows = await prisma.exportJob.count({
  where: { userId: user.id, resumeId: null },
});
console.log(`ExportJob rows with resumeId = NULL: ${orphanRows}`);

const attachedRows = await prisma.exportJob.count({
  where: { userId: user.id, resumeId: resume.id },
});
console.log(`ExportJob rows still attached to deleted resume: ${attachedRows}`);

await prisma.$disconnect();
