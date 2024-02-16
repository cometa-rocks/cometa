import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'translateName',
  standalone: true,
})
export class TranslateNamePipe implements PipeTransform {
  transform(value: string): string {
    switch (value) {
      case 'ios':
        return 'iOS';
      case 'android':
        return 'Android';
      default:
        return value;
    }
  }
}
