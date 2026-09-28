import { bounceRow } from "./bounce-row";
import { conveyor } from "./conveyor";
import { puzzleCube } from "./puzzle-cube";
import { ring } from "./ring";

export const SCENES = { "puzzle-cube": puzzleCube, "bounce-row": bounceRow, conveyor, ring };
export type SceneName = keyof typeof SCENES;
