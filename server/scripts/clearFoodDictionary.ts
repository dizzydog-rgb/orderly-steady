import prisma from "../db";

async function main() {
  const { count } = await prisma.foodDictionary.deleteMany({});
  console.log(`已清除 ${count} 筆 FoodDictionary 快取`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
