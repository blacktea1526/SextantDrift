export class Logger {
  info(msg: string, ...args: any[]): void {}
  warn(msg: string, ...args: any[]): void {}
  error(msg: string, ...args: any[]): void {}
}
export const logger = new Logger();
