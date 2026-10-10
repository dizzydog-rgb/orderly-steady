export const FoodType = {
  FIBER: 'F',
  PROTEIN: 'P',
  COMPLEX_CARB: 'CC',
  SIMPLE_CARB: 'SC',
  OTHER: 'OT',
} as const;

export type FoodType = (typeof FoodType)[keyof typeof FoodType];

// 後端（Prisma enum）回傳與接收的食物類別名稱；與上方前端即時計分用的縮寫值不同
export type BackendFoodType =
  | 'FIBER'
  | 'PROTEIN'
  | 'COMPLEX_CARB'
  | 'SIMPLE_CARB'
  | 'OTHER';

export interface IMealItem {
  id: string;
  type: FoodType;
  label: string;
}

export interface IFoodBreakdown {
  slot: number;
  label: string | null;
  type: string | null;
  isOther: boolean;
}

export interface IScoringResult {
  totalScore: number | null;
  scorableCount: number;
  breakdown: IFoodBreakdown[];
  tips: string[];
}

export interface IUser {
  id: string;
  email: string;
  name: string | null;
}

export interface IFoodItemRecord {
  label: string;
  type: string;
  sequenceIndex: number;
  finalScore: number;
}

export interface IMealRecord {
  id: string;
  totalScore: number;
  tips: string[] | null;
  recordedAt: string;
  foodItems: IFoodItemRecord[];
}

export interface IUpdateFoodTypeRequest {
  type: BackendFoodType;
}

export interface IUpsertFoodOverrideRequest {
  label: string;
  type: BackendFoodType;
}

// record 為 null 代表修正後全為「其他」、無法計分，該筆紀錄已被刪除
export interface IFoodTypeCorrectionResponse {
  record: IMealRecord | null;
  analysis: IScoringResult;
}

export interface IUpdateNicknameRequest {
  name: string;
}

export interface IUpdateNicknameResponse {
  message: string;
  user: IUser;
}

export interface IChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface IApiErrorResponse {
  error: string;
  details?: { field: string; message: string }[];
}
