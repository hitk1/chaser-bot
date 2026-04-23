-- AlterTable
ALTER TABLE "Message" ADD COLUMN "discordMessageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Message_discordMessageId_key" ON "Message"("discordMessageId");
