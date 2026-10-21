import { BRIGHT_BACKGROUND, brightRules, brightRulesByLayer } from "./bright";
import {
  DARK_MATTER_BACKGROUND,
  darkMatterRules,
  darkMatterRulesByLayer,
} from "./dark-matter";
import {
  FJORD_BACKGROUND,
  fjordRules,
  fjordRulesByLayer,
  type Rule,
} from "./fjord";

/** The bundled OpenMapTiles styles; the tile worker and the scene both read them from here. */
export type VectorStyle = {
  id: "bright" | "fjord" | "dark-matter";
  rules: Rule[];
  index: Map<string, number[]>;
  background: string;
};
export const vectorStyles: Record<VectorStyle["id"], VectorStyle> = {
  bright: {
    id: "bright",
    rules: brightRules,
    index: brightRulesByLayer,
    background: BRIGHT_BACKGROUND,
  },
  fjord: {
    id: "fjord",
    rules: fjordRules,
    index: fjordRulesByLayer,
    background: FJORD_BACKGROUND,
  },
  "dark-matter": {
    id: "dark-matter",
    rules: darkMatterRules,
    index: darkMatterRulesByLayer,
    background: DARK_MATTER_BACKGROUND,
  },
};
