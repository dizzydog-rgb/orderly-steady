-- AlterTable
ALTER TABLE `User` ADD COLUMN `password` VARCHAR(191) NULL,
    ADD COLUMN `refreshToken` VARCHAR(191) NULL;
