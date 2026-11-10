-- CreateTable
CREATE TABLE "ad_clicks" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "gclid" TEXT,
    "gbraid" TEXT,
    "wbraid" TEXT,
    "fbclid" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "utm_content" TEXT,
    "utm_term" TEXT,
    "conversation_id" TEXT,
    "matched_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_conversions" (
    "id" TEXT NOT NULL,
    "ad_click_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "meta_sent_at" TIMESTAMP(3),
    "meta_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ad_clicks_token_key" ON "ad_clicks"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ad_clicks_conversation_id_key" ON "ad_clicks"("conversation_id");

-- CreateIndex
CREATE INDEX "ad_clicks_created_at_idx" ON "ad_clicks"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ad_conversions_ad_click_id_kind_key" ON "ad_conversions"("ad_click_id", "kind");

-- AddForeignKey
ALTER TABLE "ad_clicks" ADD CONSTRAINT "ad_clicks_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_conversions" ADD CONSTRAINT "ad_conversions_ad_click_id_fkey" FOREIGN KEY ("ad_click_id") REFERENCES "ad_clicks"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "ad_clicks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ad_conversions" ENABLE ROW LEVEL SECURITY;
