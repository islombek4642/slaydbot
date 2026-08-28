import PptxGenJS from "pptxgenjs";

export class PresentationBuilder {
  private readonly pptx: PptxGenJS;
  private readonly slides: PptxGenJS.Slide[] = [];

  constructor() {
    this.pptx = new PptxGenJS();
  }

  addSlide(): number {
    const slide = this.pptx.addSlide();
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
