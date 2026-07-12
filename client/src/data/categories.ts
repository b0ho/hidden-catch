export interface Category {
  id: string;
  title: string;
  stageCount: number;
}

export const categories: Category[] = [
  { id: 'hanok', title: '한옥', stageCount: 30 },
  { id: 'temple', title: '사찰', stageCount: 30 },
  { id: 'wildflowers', title: '들꽃', stageCount: 30 },
  { id: 'diving-helmet', title: '소품', stageCount: 30 },
  { id: 'cliff-cave', title: '절벽 동굴', stageCount: 30 },
];
