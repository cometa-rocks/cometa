import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'log',
    standalone: true
})
export class LogPipe implements PipeTransform {

  transform(value: unknown): unknown {
    return value;
  }

}
