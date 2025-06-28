-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Twin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "specURL" TEXT NOT NULL,
    "capabilities" TEXT NOT NULL,
    "eventMeshURL" TEXT NOT NULL DEFAULT 'ws://localhost:5000',
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Twin" ("capabilities", "id", "registeredAt", "specURL") SELECT "capabilities", "id", "registeredAt", "specURL" FROM "Twin";
DROP TABLE "Twin";
ALTER TABLE "new_Twin" RENAME TO "Twin";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
