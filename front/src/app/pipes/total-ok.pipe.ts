import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'totalOk',
  standalone: true,
})
export class TotalOkPipe implements PipeTransform {
  transform(steps: StepResult[]): number {
    const count = steps.reduce((r, step) => {
      if (step.success) r++;
      return r;
    }, 0);
    return +Math.trunc((count * 100) / steps.length).toFixed(0);
  }
}
