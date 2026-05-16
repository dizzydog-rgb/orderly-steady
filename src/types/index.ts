export const FoodType = {
  FIBER: 'F',
  PROTEIN: 'P',
  COMPLEX_CARB: 'CC',
  SIMPLE_CARB: 'SC',
} as const;

export type FoodType = (typeof FoodType)[keyof typeof FoodType];

export interface IMealItem {
  id: string;
  type: FoodType;
  label: string;
}

export interface ISlotBreakdown {
  slot: 1 | 2 | 3;
  input: FoodType | null;
  slotMax: 50 | 30 | 20;
  score: number;
}

export interface IScoringResult {
  totalScore: number;
  breakdown: ISlotBreakdown[];
  tips: string[];
}
