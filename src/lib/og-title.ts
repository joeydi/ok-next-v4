// The title column on an Open Graph card, shared by both drawings (renderOg in og.tsx,
// OgCardHtml) and /admin/og's width sliders. A card's own width (OgCard.titleWidth)
// overrides the default.

/** The default width: fixed beside an image, a cap otherwise (a poster takes the right). */
export const defaultTitleWidth = (image: boolean, poster: boolean) => (image ? 504 : poster ? 680 : 860);

/** The widest it fits: the card inside its 64px padding, or beside an image, left of the 520px frame and 48px gap. */
export const maxTitleWidth = (image: boolean) => (image ? 504 : 1072);

export const MIN_TITLE_WIDTH = 240;
