/*
  Warnings:

  - You are about to drop the column `baseScore` on the `FoodItem` table. All the data in the column will be lost.
  - You are about to drop the column `finalScore` on the `FoodItem` table. All the data in the column will be lost.
  - You are about to drop the column `modifier` on the `FoodItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `FoodItem` DROP COLUMN `baseScore`,
    DROP COLUMN `finalScore`,
    DROP COLUMN `modifier`;
