import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'numeral',
  standalone: true,
})
export class NumeralPipe implements PipeTransform {
  transform(value: number): string | number {
    if (!value) return '';
    // Format with million
    if (value > Math.pow(10, 6))
      return Math.trunc(value / Math.pow(10, 6)) + 'M';
    // Format with thousand
    if (value > Math.pow(10, 3))
      return Math.trunc(value / Math.pow(10, 3)) + 'K';
    // Don't format
    return value;
  }
}
