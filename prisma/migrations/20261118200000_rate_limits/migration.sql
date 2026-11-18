-- Penghitung percobaan untuk membatasi login, pendaftaran, email, dan checkout.
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" BIGINT NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "rate_limits_resetAt_idx" ON "rate_limits"("resetAt");
