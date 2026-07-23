-- CreateTable
CREATE TABLE "project_share_links" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "token_prefix" TEXT NOT NULL,
    "created_by_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_share_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_share_links_token_hash_key" ON "project_share_links"("token_hash");

-- CreateIndex
CREATE INDEX "project_share_links_project_id_idx" ON "project_share_links"("project_id");

-- AddForeignKey
ALTER TABLE "project_share_links" ADD CONSTRAINT "project_share_links_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_share_links" ADD CONSTRAINT "project_share_links_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
