import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'percentage'
})
export class PercentagePipe implements PipeTransform {

  transform(part: number, total: number, sign: boolean = true): string {
    const signValue = sign ? '%' : '';
    if (part === 0 && total === 0) return '0' + signValue;
    if (part === 0) return '0' + signValue;
    const percentage = (part * 100) / total;
    if (percentage == 100) {
      return `${percentage}${signValue}`
    } else {
      return `${percentage.toFixed(2)}${signValue}`
    }
  }

}
