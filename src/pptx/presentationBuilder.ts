import PptxGenJS from "pptxgenjs";

export class PresentationBuilder {
  private readonly pptx: PptxGenJS;
  private readonly slides: PptxGenJS.Slide[] = [];

  constructor() {
    this.pptx = new PptxGenJS();
    // pptxgenjs defaults to LAYOUT_16x9 (10" x 5.625"), not the 13.33" x 7.5"
    // widescreen canvas the AI is told about in designGuide.ts - without this,
    // coordinates the AI computes for a wide canvas would land off-slide.
    this.pptx.layout = "LAYOUT_WIDE";
  }

  addSlide(options: { background?: string } = {}): number {
    const slide = this.pptx.addSlide();
    if (options.background) {
      slide.background = { color: options.background };
    }
    this.slides.push(slide);
    return this.slides.length - 1;
  }

  addText(slideIndex: number, text: string, options: PptxGenJS.TextPropsOptions = {}): void {
    // pptxgenjs mutates the options object in place (fills in defaults); clone
    // it so callers never see their own objects change out from under them.
    this.getSlide(slideIndex).addText(text, { ...options });
  }

  addImage(slideIndex: number, options: PptxGenJS.ImageProps): void {
    this.getSlide(slideIndex).addImage({ ...options });
  }

  addChart(
    slideIndex: number,
    type: PptxGenJS.CHART_NAME,
    data: PptxGenJS.OptsChartData[],
    options: PptxGenJS.IChartOpts = {}
  ): void {
    this.getSlide(slideIndex).addChart(type, data, { ...options });
  }

  addShape(
    slideIndex: number,
    shapeType: PptxGenJS.SHAPE_NAME,
    options: PptxGenJS.ShapeProps = {}
  ): void {
    this.getSlide(slideIndex).addShape(shapeType, { ...options });
  }

  addTable(slideIndex: number, rows: PptxGenJS.TableRow[], options: PptxGenJS.TableProps = {}): void {
    this.getSlide(slideIndex).addTable(rows, { ...options });
  }

  addNotes(slideIndex: number, notes: string): void {
    this.getSlide(slideIndex).addNotes(notes);
  }

  slideCount(): number {
    return this.slides.length;
  }

  async toBuffer(): Promise<Buffer> {
    const output = await this.pptx.write({ outputType: "nodebuffer" });
    return output as Buffer;
  }

  private getSlide(index: number): PptxGenJS.Slide {
    const slide = this.slides[index];
    if (!slide) {
      throw new Error(`Slide index ${index} does not exist`);
    }
    return slide;
  }
}
