export type Occasion =
  | "All Moments"
  | "Birthday Party"
  | "Romantic Date"
  | "Movie Night"
  | "Marriage Proposal"
  | "Anniversary"
  | "Baby Shower"
  | "Congratulations"
  | "Farewell";

export type GalleryItem = {
  id: string;
  src: string;
  occasion: Occasion;
  caption: string;
};
