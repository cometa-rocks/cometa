import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatVersion',
})
export class FormatVersionPipe implements PipeTransform {
  transform(version: string): string {
    if (!version) return '';
    return version.replace(/\.0/gi, '').replace(/Iphone/, 'iPhone');
  }
}
