import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'pixelDifference'
})
export class PixelDifferencePipe implements PipeTransform {

  transform(value: number): string {
    if (value) {
      return value.toLocaleString();
    } else {
      return '-';
    }
  }
}
