-- CreateTable
CREATE TABLE "Twin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "specURL" TEXT NOT NULL,
    "capabilities" TEXT NOT NULL,
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
