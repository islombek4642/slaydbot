import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { ICON_SET, type IconName } from "./iconSet";

const RENDER_SIZE_PX = 128;

export function renderIconToSvg(iconName: IconName, colorHex: string): string {
  const Icon = ICON_SET[iconName];
  if (!Icon) {
    throw new Error(`Unknown icon: ${iconName}`);
  }
  return renderToStaticMarkup(React.createElement(Icon, { size: RENDER_SIZE_PX, color: `#${colorHex}` }));
}

export async function renderIconToPngDataUri(iconName: IconName, colorHex: string): Promise<string> {
  const svg = renderIconToSvg(iconName, colorHex);
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${pngBuffer.toString("base64")}`;
}
