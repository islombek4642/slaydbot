import type { ThemeName } from "../../config/constants";
import type { Theme } from "./types";
import { corporateTheme } from "./corporate";
import { creativeTheme } from "./creative";
import { minimalTheme } from "./minimal";
import { darkTheme } from "./dark";

export const THEMES: Record<ThemeName, Theme> = {
  corporate: corporateTheme,
  creative: creativeTheme,
  minimal: minimalTheme,
  dark: darkTheme,
};

export function getTheme(name: ThemeName): Theme {
  return THEMES[name];
}

export type { Theme };
