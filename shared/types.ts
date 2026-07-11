export type DiffEditType =
  | 'colorChange'
  | 'objectRemove'
  | 'resize'
  | 'flip'
  | 'duplicate';

/** Center + radius are fractions (0..1) of image width, so they survive any responsive layout. */
export interface DiffRegion {
  x: number;
  y: number;
  radius: number;
  editType: DiffEditType;
}

export interface StageMeta {
  id: string;
  diffs: DiffRegion[];
}

export interface StageSummary {
  id: string;
  title: string;
  thumbnail: string;
}
