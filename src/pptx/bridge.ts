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
    addSlide: () => builder.addSlide(),

    addText: (slideIndex: number, text: string, options: PptxGenJS.TextPropsOptions = {}) =>
      builder.addText(slideIndex, text, options),

    addImage: (slideIndex: number, options: PptxGenJS.ImageProps) => builder.addImage(slideIndex, options),

    addChart: (
      slideIndex: number,
      type: PptxGenJS.CHART_NAME,
      data: PptxGenJS.OptsChartData[],
      options: PptxGenJS.IChartOpts = {}
    ) => builder.addChart(slideIndex, type, data, options),

    addShape: (slideIndex: number, shapeType: PptxGenJS.SHAPE_NAME, options: PptxGenJS.ShapeProps = {}) =>
      builder.addShape(slideIndex, shapeType, options),

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
