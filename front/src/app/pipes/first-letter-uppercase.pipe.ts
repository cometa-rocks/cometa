import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'firstLetterUppercase',
    standalone: true
})
export class FirstLetterUppercasePipe implements PipeTransform {

  transform(value: string): string {
    return value.charAt(0).toUpperCase() + value?.slice(1);
  }

}
