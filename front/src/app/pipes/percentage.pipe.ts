import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'percentage'
})
export class PercentagePipe implements PipeTransform {

  transform(part: number, total: number, sign: boolean = true): string {
    if (part === 0 && total === 0) return '0' + (sign ? ' %' : '');
    if (part === 0) return '0' + (sign ? ' %' : '');
    return ((part * 100) / total).toFixed(0) + (sign ? ' %' : '');
  }

}
