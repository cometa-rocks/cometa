import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'percentageField',
})
export class PercentageFieldPipe implements PipeTransform {
  /**
   * Automatic field number generator
   * whenever the percent is true, it will be shown as a percent using total number
   * whenever the percent is false, it will be shown as part only
   * @param part Part of total or just the number
   * @param total Total number (optional)
   */
  transform(part: number, total: number = null): string | number {
    return ((part * 100) / total).toFixed(0) + '%';
  }
}
