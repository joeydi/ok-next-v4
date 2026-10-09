import { bounceRow } from "./bounce-row";
import { careCatch } from "./care-catch";
import { carePatch } from "./care-patch";
import { careStack } from "./care-stack";
import { conveyor } from "./conveyor";
import { puzzleCube } from "./puzzle-cube";
import { ring } from "./ring";

export const SCENES = {
  "puzzle-cube": puzzleCube,
  "bounce-row": bounceRow,
  conveyor,
  ring,
  "care-stack": careStack,
  "care-catch": careCatch,
  "care-patch": carePatch,
};
export type SceneName = keyof typeof SCENES;
