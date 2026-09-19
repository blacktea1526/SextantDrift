export class Telemetry {
  recordSpan(name: string, fn: () => any): any {
    return fn();
  }
}
export const telemetry = new Telemetry();
