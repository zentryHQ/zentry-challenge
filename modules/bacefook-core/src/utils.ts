export class Utils {
  public static randInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  public static chance(p: number): boolean {
    return Math.random() < p;
  }

  public static timestamp(): string {
    return new Date().toISOString().replace(/[-:.]/g, "");
  }
}
