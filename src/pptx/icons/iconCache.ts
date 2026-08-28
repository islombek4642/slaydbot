import { renderIconToPngDataUri } from "./renderer";
import { ICON_NAMES, type IconName } from "./iconSet";
import type { Theme } from "../themes/types";

export class IconCache {
  private readonly cache = new Map<string, string>();

  get(iconName: string, colorHex: string): string | undefined {
    return this.cache.get(this.key(iconName, colorHex));
  }

  async warmTheme(theme: Theme): Promise<void> {
    const colors = [theme.primaryColor, theme.secondaryColor, theme.textColor];
    for (const iconName of ICON_NAMES) {
      for (const color of colors) {
        const key = this.key(iconName, color);
        if (!this.cache.has(key)) {
          this.cache.set(key, await renderIconToPngDataUri(iconName as IconName, color));
        }
      }
    }
  }

  private key(iconName: string, colorHex: string): string {
    return `${iconName}:${colorHex.toUpperCase()}`;
  }
}
