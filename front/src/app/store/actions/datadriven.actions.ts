export namespace DataDriven {
  export class StatusUpdate {
    static readonly type = '[WebSockets] DataDrivenStatusUpdate';
    constructor(
      public run_id: number,
      public running: boolean,
      public status?: string,
      public total?: number,
      public ok?: number,
      public fails?: number,
      public skipped?: number,
      public execution_time?: number,
      public pixel_diff?: number
    ) {}
  }
} 