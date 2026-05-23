export const FoodType = {
  FIBER: 'F',
  PROTEIN: 'P',
  COMPLEX_CARB: 'CC',
  SIMPLE_CARB: 'SC',
  OTHER: 'OT',
} as const;

export type FoodType = (typeof FoodType)[keyof typeof FoodType];

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
  totalScore: number;
  scorableCount: number;
  inversions: number;
  maxInversions: number;
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
