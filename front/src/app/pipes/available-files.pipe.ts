import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'availableFiles',
})
export class AvailableFilesPipe implements PipeTransform {
  transform(files): string {
    return files.filter(f => !f.is_removed);
  }
}
