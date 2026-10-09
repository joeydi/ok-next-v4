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
  "care-stack": careStack,
  "care-catch": careCatch,
  "care-patch": carePatch,
  // Website care concepts, exploring; the page uses care-catch, so drop these once settled.
  "care-ping": carePing,
  "care-seesaw": careSeesaw,
};
export type SceneName = keyof typeof SCENES;
