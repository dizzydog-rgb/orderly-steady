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

export interface IScoringResult {
  totalScore: number;
  breakdown: {
    baseScore: number;
    modifier: number;
    finalItemScore: number;
    type: FoodType;
  }[];
}
