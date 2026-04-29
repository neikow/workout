export type LineKind =
  | "date"
  | "exercise"
  | "working-set"
  | "warmup-set"
  | "comment";

export type Theme = "system" | "light" | "dark" | "monokai";

export interface WorkoutContext {
  warmupMarker: string;
  dateFormat: string;
  theme: Theme;
}

export interface WorkoutRule {
  name: string;
  priority: number;
  match(text: string, ctx: WorkoutContext): LineKind | null;
}
