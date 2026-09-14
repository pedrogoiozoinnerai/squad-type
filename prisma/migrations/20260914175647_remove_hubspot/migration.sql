/*
  Warnings:

  - You are about to drop the column `hubspotContactId` on the `Lead` table. All the data in the column will be lost.
  - You are about to drop the column `hubspotDealId` on the `Lead` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Lead" DROP COLUMN "hubspotContactId",
DROP COLUMN "hubspotDealId";
