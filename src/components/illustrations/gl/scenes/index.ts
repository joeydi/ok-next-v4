import { bounceRow } from "./bounce-row";
import { careCatch } from "./care-catch";
import { carePatch } from "./care-patch";
import { carePing } from "./care-ping";
import { careSeesaw } from "./care-seesaw";
import { careStack } from "./care-stack";
import { conveyor } from "./conveyor";
import { puzzleCube } from "./puzzle-cube";
import { ring } from "./ring";

export const SCENES = {
  "puzzle-cube": puzzleCube,
  "bounce-row": bounceRow,
  conveyor,
  ring,
  // Website care concepts, exploring; keep the one chosen and drop the rest.
  "care-patch": carePatch,
  "care-stack": careStack,
  "care-ping": carePing,
  "care-seesaw": careSeesaw,
  "care-catch": careCatch,
};
export type SceneName = keyof typeof SCENES;
