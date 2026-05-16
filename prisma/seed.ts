import { PrismaClient, FoodType } from "@prisma/client";

const prisma = new PrismaClient();

const FOOD_DICTIONARY: { label: string; type: FoodType }[] = [
  // FIBER — 膳食纖維（18 筆）
  { label: "花椰菜",   type: FoodType.FIBER },
  { label: "菠菜",     type: FoodType.FIBER },
  { label: "高麗菜",   type: FoodType.FIBER },
  { label: "生菜",     type: FoodType.FIBER },
  { label: "小黃瓜",   type: FoodType.FIBER },
  { label: "番茄",     type: FoodType.FIBER },
  { label: "香菇",     type: FoodType.FIBER },
  { label: "金針菇",   type: FoodType.FIBER },
  { label: "木耳",     type: FoodType.FIBER },
  { label: "海帶",     type: FoodType.FIBER },
  { label: "地瓜葉",   type: FoodType.FIBER },
  { label: "空心菜",   type: FoodType.FIBER },
  { label: "豆芽菜",   type: FoodType.FIBER },
  { label: "蘆筍",     type: FoodType.FIBER },
  { label: "苦瓜",     type: FoodType.FIBER },
  { label: "青椒",     type: FoodType.FIBER },
  { label: "紅蘿蔔",   type: FoodType.FIBER },
  { label: "洋蔥",     type: FoodType.FIBER },

  // PROTEIN — 蛋白質（16 筆）
  { label: "雞胸肉",   type: FoodType.PROTEIN },
  { label: "豬里肌",   type: FoodType.PROTEIN },
  { label: "牛肉",     type: FoodType.PROTEIN },
  { label: "鮭魚",     type: FoodType.PROTEIN },
  { label: "蝦仁",     type: FoodType.PROTEIN },
  { label: "雞蛋",     type: FoodType.PROTEIN },
  { label: "豆腐",     type: FoodType.PROTEIN },
  { label: "豆干",     type: FoodType.PROTEIN },
  { label: "毛豆",     type: FoodType.PROTEIN },
  { label: "鯖魚",     type: FoodType.PROTEIN },
  { label: "鱈魚",     type: FoodType.PROTEIN },
  { label: "花枝",     type: FoodType.PROTEIN },
  { label: "牡蠣",     type: FoodType.PROTEIN },
  { label: "起司",     type: FoodType.PROTEIN },
  { label: "無糖豆漿", type: FoodType.PROTEIN },
  { label: "水煮蛋",   type: FoodType.PROTEIN },

  // COMPLEX_CARB — 複合碳水（10 筆）
  { label: "白飯",     type: FoodType.COMPLEX_CARB },
  { label: "糙米飯",   type: FoodType.COMPLEX_CARB },
  { label: "地瓜",     type: FoodType.COMPLEX_CARB },
  { label: "馬鈴薯",   type: FoodType.COMPLEX_CARB },
  { label: "燕麥",     type: FoodType.COMPLEX_CARB },
  { label: "全麥吐司", type: FoodType.COMPLEX_CARB },
  { label: "玉米",     type: FoodType.COMPLEX_CARB },
  { label: "南瓜",     type: FoodType.COMPLEX_CARB },
  { label: "蕎麥麵",   type: FoodType.COMPLEX_CARB },
  { label: "五穀飯",   type: FoodType.COMPLEX_CARB },

  // SIMPLE_CARB — 精緻碳水（6 筆）
  { label: "白吐司",   type: FoodType.SIMPLE_CARB },
  { label: "蛋糕",     type: FoodType.SIMPLE_CARB },
  { label: "餅乾",     type: FoodType.SIMPLE_CARB },
  { label: "含糖飲料", type: FoodType.SIMPLE_CARB },
  { label: "珍珠奶茶", type: FoodType.SIMPLE_CARB },
  { label: "白麵包",   type: FoodType.SIMPLE_CARB },
];

async function main() {
  console.log("清除舊有 FoodDictionary 資料（含亂碼）...");
  const deleted = await prisma.foodDictionary.deleteMany();
  console.log(`已刪除 ${deleted.count} 筆`);

  console.log(`\n寫入 ${FOOD_DICTIONARY.length} 筆食物資料...`);
  const result = await prisma.foodDictionary.createMany({
    data: FOOD_DICTIONARY,
    skipDuplicates: true,
  });
  console.log(`成功寫入 ${result.count} 筆`);

  // 驗證中文字正確儲存
  console.log("\n驗證中文儲存（抽查各類別各 1 筆）:");
  const samples = await prisma.foodDictionary.findMany({
    where: { label: { in: ["花椰菜", "雞胸肉", "白飯", "蛋糕"] } },
    select: { label: true, type: true },
  });
  samples.forEach(s => console.log(`  ${s.label} → ${s.type}`));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
