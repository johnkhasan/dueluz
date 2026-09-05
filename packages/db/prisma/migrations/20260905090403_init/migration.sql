-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'BANNED');

-- CreateEnum
CREATE TYPE "DuelStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN', 'DELETED');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'UNLISTED');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('VISIBLE', 'HIDDEN', 'DELETED');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('DUEL', 'COMMENT');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'NSFW', 'HATE', 'HARASSMENT', 'COPYRIGHT', 'MISINFORMATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ShareChannel" AS ENUM ('COPY', 'TELEGRAM', 'WHATSAPP', 'X', 'FACEBOOK', 'NATIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DUEL_VOTE', 'DUEL_COMMENT', 'DUEL_LIKE', 'COMMENT_LIKE', 'MODERATION', 'SYSTEM');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "avatar_url" TEXT,
    "avatar_key" TEXT,
    "bio" VARCHAR(280),
    "locale" VARCHAR(5) NOT NULL DEFAULT 'uz',
    "role" "Role" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "banned_until" TIMESTAMP(3),
    "ban_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_agent" VARCHAR(400),
    "ip_hash" VARCHAR(64),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name_uz" TEXT NOT NULL,
    "name_ru" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "emoji" VARCHAR(8) NOT NULL,
    "color" VARCHAR(9) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "duel_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duels" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" VARCHAR(140) NOT NULL,
    "description" VARCHAR(500),
    "author_id" TEXT,
    "category_id" TEXT NOT NULL,
    "status" "DuelStatus" NOT NULL DEFAULT 'PUBLISHED',
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "vote_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "share_count" INTEGER NOT NULL DEFAULT 0,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "hot_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "search_text" TEXT NOT NULL DEFAULT '',
    "moderation_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "duels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duel_options" (
    "id" TEXT NOT NULL,
    "duel_id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "image_url" TEXT,
    "image_key" TEXT,
    "color" VARCHAR(9) NOT NULL DEFAULT '#6366f1',
    "position" INTEGER NOT NULL,
    "vote_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "duel_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" TEXT NOT NULL,
    "duel_id" TEXT NOT NULL,
    "option_id" TEXT NOT NULL,
    "user_id" TEXT,
    "anon_id" VARCHAR(64),
    "ip_hash" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duel_likes" (
    "id" TEXT NOT NULL,
    "duel_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "duel_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "duel_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" VARCHAR(1000) NOT NULL,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "status" "CommentStatus" NOT NULL DEFAULT 'VISIBLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_likes" (
    "id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shares" (
    "id" TEXT NOT NULL,
    "duel_id" TEXT NOT NULL,
    "channel" "ShareChannel" NOT NULL,
    "user_id" TEXT,
    "anon_id" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "target_type" "ReportTargetType" NOT NULL,
    "duel_id" TEXT,
    "comment_id" TEXT,
    "reporter_id" TEXT,
    "reporter_anon" VARCHAR(64),
    "reason" "ReportReason" NOT NULL,
    "details" VARCHAR(500),
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "resolution_note" VARCHAR(500),
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "user_id" TEXT,
    "anon_id" VARCHAR(64),
    "duel_id" TEXT,
    "locale" VARCHAR(5),
    "props" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_is_active_position_idx" ON "categories"("is_active", "position");

-- CreateIndex
CREATE UNIQUE INDEX "duels_slug_key" ON "duels"("slug");

-- CreateIndex
CREATE INDEX "duels_status_published_at_idx" ON "duels"("status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "duels_status_hot_score_idx" ON "duels"("status", "hot_score" DESC);

-- CreateIndex
CREATE INDEX "duels_status_vote_count_idx" ON "duels"("status", "vote_count" DESC);

-- CreateIndex
CREATE INDEX "duels_status_category_id_published_at_idx" ON "duels"("status", "category_id", "published_at" DESC);

-- CreateIndex
CREATE INDEX "duels_author_id_created_at_idx" ON "duels"("author_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "duel_options_duel_id_idx" ON "duel_options"("duel_id");

-- CreateIndex
CREATE UNIQUE INDEX "duel_options_duel_id_position_key" ON "duel_options"("duel_id", "position");

-- CreateIndex
CREATE INDEX "votes_duel_id_idx" ON "votes"("duel_id");

-- CreateIndex
CREATE INDEX "votes_option_id_idx" ON "votes"("option_id");

-- CreateIndex
CREATE INDEX "votes_user_id_created_at_idx" ON "votes"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "votes_created_at_idx" ON "votes"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "votes_duel_id_user_id_key" ON "votes"("duel_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "votes_duel_id_anon_id_key" ON "votes"("duel_id", "anon_id");

-- CreateIndex
CREATE INDEX "duel_likes_user_id_created_at_idx" ON "duel_likes"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "duel_likes_duel_id_user_id_key" ON "duel_likes"("duel_id", "user_id");

-- CreateIndex
CREATE INDEX "comments_duel_id_status_created_at_idx" ON "comments"("duel_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "comments_user_id_created_at_idx" ON "comments"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "comment_likes_comment_id_user_id_key" ON "comment_likes"("comment_id", "user_id");

-- CreateIndex
CREATE INDEX "shares_duel_id_created_at_idx" ON "shares"("duel_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reports_duel_id_idx" ON "reports"("duel_id");

-- CreateIndex
CREATE INDEX "reports_comment_id_idx" ON "reports"("comment_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at" DESC);

-- CreateIndex
CREATE INDEX "analytics_events_name_created_at_idx" ON "analytics_events"("name", "created_at" DESC);

-- CreateIndex
CREATE INDEX "analytics_events_created_at_idx" ON "analytics_events"("created_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duels" ADD CONSTRAINT "duels_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duels" ADD CONSTRAINT "duels_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duel_options" ADD CONSTRAINT "duel_options_duel_id_fkey" FOREIGN KEY ("duel_id") REFERENCES "duels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_duel_id_fkey" FOREIGN KEY ("duel_id") REFERENCES "duels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "duel_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duel_likes" ADD CONSTRAINT "duel_likes_duel_id_fkey" FOREIGN KEY ("duel_id") REFERENCES "duels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duel_likes" ADD CONSTRAINT "duel_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_duel_id_fkey" FOREIGN KEY ("duel_id") REFERENCES "duels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shares" ADD CONSTRAINT "shares_duel_id_fkey" FOREIGN KEY ("duel_id") REFERENCES "duels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shares" ADD CONSTRAINT "shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_duel_id_fkey" FOREIGN KEY ("duel_id") REFERENCES "duels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_duel_id_fkey" FOREIGN KEY ("duel_id") REFERENCES "duels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
