"use client";

import { DiagramFigure } from "../DiagramFigure";
import { Surface } from "../parts";
import { useLoop } from "../useLoop";
import { LOOP, PAGE, Page, PerformancePage, SummaryPage, UptimePage } from "./Pages";

// The website care page's diagram, in place of a screenshot of the monthly report:
// three of its pages standing in a cascade, turned to the left in perspective, the
// summary in front and two later pages receding up and to the right behind it. It's
// decorative more than technical, so it's set straight on the page, with no frame or
// jog wheel, and a check runs on each page behind: the uptime check sweeps the month,
// and the audits run down the scores.

const SIZE = [1120, 840] as const; // 4:3, close to the stack's own shape, so it fills both ways
const STILL = 2.4; // s: the sweep mid-month, the second audit running (the reduced-motion frame)
const RATE = 1.5; // playback speed
const BOB = 4; // px: how far a page floats, up and down
const STEP = [230, -64, -110]; // px from a page to the one behind it: across, up, and away
const MARGIN = [70, 20]; // px: the least room left either side, and above and below
// The stack's extent on screen at zoom 1 (measured in the browser), and how far its centre sits
// from the surface's: it's zoomed to fit and moved back to the centre.
const BOX = [881, 735];
const OFF = [68, 20];
const ZOOM = Math.min((SIZE[0] - 2 * MARGIN[0]) / BOX[0], (SIZE[1] - 2 * MARGIN[1]) / BOX[1]);

const DESCRIPTION =
  "Three pages of a monthly website maintenance report for Columbia Capital, stacked. In front, the summary: uptime, response time, Lighthouse, SSL and accessibility figures, what changed this period, and the plugin updates applied. Behind it, the performance tests, with Lighthouse scores and Core Web Vitals for three pages, and uptime monitoring, with a bar for each day of September and the site's SSL certificates.";

/** Page `i`'s float, back to front, `t` s into the loop: a whole period per loop, each a little behind the last. */
const bob = (i: number, t: number) => BOB * Math.sin(2 * Math.PI * (t / LOOP - i / 6));

export function ReportDiagram({ className, time }: { className?: string; time?: number }) {
  const [ref, t] = useLoop<HTMLElement>(LOOP, { still: STILL, time, rate: RATE });
  // Back to front: page 3, page 5, page 1.
  const pages = [
    <Page key={3} n={3}>
      <UptimePage t={t} />
    </Page>,
    <Page key={5} n={5}>
      <PerformancePage t={t} />
    </Page>,
    <Page key={1} n={1}>
      <SummaryPage />
    </Page>,
  ];
  return (
    <DiagramFigure ref={ref} bare className={className} description={DESCRIPTION}>
      <Surface size={SIZE} open>
        <div
          className="absolute inset-0"
          style={{
            perspective: 1800,
            perspectiveOrigin: "40% 40%",
            scale: ZOOM,
            transformOrigin: `${SIZE[0] / 2}px ${SIZE[1] / 2}px`,
            translate: `${-ZOOM * OFF[0]}px ${-ZOOM * OFF[1]}px`,
          }}
        >
          <div
            className="absolute"
            style={{
              left: (SIZE[0] - PAGE[0]) / 2 - 170,
              top: (SIZE[1] - PAGE[1]) / 2 + 60,
              width: PAGE[0],
              height: PAGE[1],
              transformStyle: "preserve-3d",
              transform: "scale(0.82) rotateX(10deg) rotateY(-26deg) rotateZ(1deg)",
            }}
          >
            {pages.map((page, i) => {
              const k = 2 - i; // steps behind the front page
              return (
                <div
                  key={page.key}
                  className="absolute"
                  style={{
                    width: PAGE[0],
                    height: PAGE[1],
                    transform: `translate3d(${k * STEP[0]}px, ${k * STEP[1] + bob(i, t)}px, ${k * STEP[2]}px)`,
                  }}
                >
                  {page}
                </div>
              );
            })}
          </div>
        </div>
      </Surface>
    </DiagramFigure>
  );
}
