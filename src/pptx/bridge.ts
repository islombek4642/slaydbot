import type PptxGenJS from "pptxgenjs";
import type { PresentationBuilder } from "./presentationBuilder";
import type { IconCache } from "./icons/iconCache";

export interface AddIconOptions {
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type BridgeFunctions = Record<string, (...args: any[]) => any>;

export function createBridgeFunctions(builder: PresentationBuilder, iconCache: IconCache): BridgeFunctions {
  return {
    addSlide: (options: { background?: string } = {}) => builder.addSlide(options),

    addText: (slideIndex: number, text: string, options: PptxGenJS.TextPropsOptions = {}) =>
      builder.addText(slideIndex, text, options),

    addImage: (slideIndex: number, options: PptxGenJS.ImageProps) => {
      // pptxgenjs fetches `path` (a URL or local filesystem path) for real,
      // on the host, while building the deck - unlike every other option
      // here, which only ever gets written into the .pptx's XML. Exposing it
      // would let generated code make the server issue arbitrary outbound
      // requests (SSRF) or read local files. `data` (a base64 data URI) is
      // the only way to supply an image.
      if (options.path !== undefined) {
        throw new Error('addImage: "path" is not allowed (no network/filesystem access) - use "data" instead');
      }
      builder.addImage(slideIndex, options);
    },

    addChart: (
      slideIndex: number,
      type: PptxGenJS.CHART_NAME,
      data: PptxGenJS.OptsChartData[],
      options: PptxGenJS.IChartOpts = {}
    ) => builder.addChart(slideIndex, type, data, options),

    addShape: (slideIndex: number, shapeType: PptxGenJS.SHAPE_NAME, options: PptxGenJS.ShapeProps = {}) =>
      builder.addShape(slideIndex, shapeType, options),

    addTable: (slideIndex: number, rows: PptxGenJS.TableRow[], options: PptxGenJS.TableProps = {}) =>
      builder.addTable(slideIndex, rows, options),

    addNotes: (slideIndex: number, notes: string) => builder.addNotes(slideIndex, notes),

    addIcon: (slideIndex: number, iconName: string, options: AddIconOptions) => {
      const dataUri = iconCache.get(iconName, options.color);
      if (!dataUri) {
        throw new Error(`Icon "${iconName}" with color "${options.color}" is not cached`);
      }
      builder.addImage(slideIndex, {
        data: dataUri,
        x: options.x,
        y: options.y,
        w: options.w,
        h: options.h,
      });
    },
  };
}
