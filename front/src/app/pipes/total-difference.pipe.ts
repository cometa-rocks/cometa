import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'totalDifference'
})
export class TotalDifferencePipe implements PipeTransform {

  transform(steps: StepResult[]): number {
    return steps.reduce((r, step) => r + step.pixel_diff, 0);
  }

}
