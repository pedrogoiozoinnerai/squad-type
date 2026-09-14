-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "StepKey" AS ENUM ('NAME', 'PHONE', 'EMAIL', 'COMPANY', 'SEGMENT', 'ROLE', 'REVENUE', 'SCHEDULE');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "currentStep" "StepKey" NOT NULL DEFAULT 'NAME',
    "completedAt" TIMESTAMP(3),
    "fullName" TEXT,
    "phoneCountryCode" TEXT,
    "phoneNumber" TEXT,
    "phoneE164" TEXT,
    "ddd" TEXT,
    "city" TEXT,
    "state" TEXT,
    "email" TEXT,
    "company" TEXT,
    "segment" TEXT,
    "role" TEXT,
    "revenueRange" TEXT,
    "calBookingUid" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "meetingLocation" TEXT,
    "hubspotContactId" TEXT,
    "hubspotDealId" TEXT,
    "consentAcceptedAt" TIMESTAMP(3),
    "privacyVersion" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "fbclid" TEXT,
    "gclid" TEXT,
    "fbp" TEXT,
    "fbc" TEXT,
    "referrer" TEXT,
    "landingUrl" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "step" "StepKey" NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_sessionId_key" ON "Lead"("sessionId");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "LeadEvent_leadId_idx" ON "LeadEvent"("leadId");

-- AddForeignKey
ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
