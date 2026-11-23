import { useState } from "react";
import type { Media } from "./api";
import { filterMedia, mediaFacets } from "./model";

/** Brand and source filters over a media list */
export function useMediaFilters(items: Media[]) {
  const [brand, setBrand] = useState("");
  const [source, setSource] = useState("");
  return { brand, setBrand, source, setSource, ...mediaFacets(items), list: filterMedia(items, brand, source) };
}
