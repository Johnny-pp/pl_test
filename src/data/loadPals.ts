import palsJson from "../../data/pals.json";
import type { Pal } from "../types/pal";

// JSON import inference widens fixed two-parent arrays to string[][]; Schema validation
// guarantees the tuple length before this data reaches the game.
export const pals = palsJson as unknown as Pal[];
