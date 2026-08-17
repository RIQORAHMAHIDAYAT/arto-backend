-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('cash', 'bank', 'ewallet');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('income', 'expense');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "theme" VARCHAR(20) NOT NULL DEFAULT 'system',
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "AccountType" NOT NULL,
    "initial_balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "name" VARCHAR(120) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "icon" VARCHAR(20) NOT NULL DEFAULT '📦',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "note" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_goals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "target_amount" DECIMAL(18,2) NOT NULL,
    "current_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "deadline" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE INDEX "categories_user_id_type_idx" ON "categories"("user_id", "type");

-- CreateIndex
CREATE INDEX "categories_type_idx" ON "categories"("type");

-- CreateIndex
CREATE INDEX "transactions_user_id_transaction_date_idx" ON "transactions"("user_id", "transaction_date");

-- CreateIndex
CREATE INDEX "transactions_account_id_idx" ON "transactions"("account_id");

-- CreateIndex
CREATE INDEX "transactions_category_id_idx" ON "transactions"("category_id");

-- CreateIndex
CREATE INDEX "budgets_user_id_period_end_idx" ON "budgets"("user_id", "period_end");

-- CreateIndex
CREATE INDEX "financial_goals_user_id_idx" ON "financial_goals"("user_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_goals" ADD CONSTRAINT "financial_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
