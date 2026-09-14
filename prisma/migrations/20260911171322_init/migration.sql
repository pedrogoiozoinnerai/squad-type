-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "currentStep" TEXT NOT NULL DEFAULT 'NAME',
    "completedAt" DATETIME,
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
    "scheduledAt" DATETIME,
    "meetingLocation" TEXT,
    "consentAcceptedAt" DATETIME,
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
    "ipAddress" TEXT
);

-- CreateTable
CREATE TABLE "LeadEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_sessionId_key" ON "Lead"("sessionId");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "LeadEvent_leadId_idx" ON "LeadEvent"("leadId");
