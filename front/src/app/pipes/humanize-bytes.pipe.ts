import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'humanizeBytes',
})
export class HumanizeBytesPipe implements PipeTransform {
  constructor() {}

  transform(bytes: number): String {
    const kiloBytes = bytes / 1024;
    if (kiloBytes < 1) return `${bytes} B`;
    const megaBytes = kiloBytes / 1024;
    if (megaBytes < 1) return `${kiloBytes.toFixed(2)} KB`;
    const gigaBytes = megaBytes / 1024;
    if (gigaBytes < 1) return `${megaBytes.toFixed(2)} MB`;
    const teraByte = gigaBytes / 1024;
    if (teraByte < 1) return `${gigaBytes.toFixed(2)} GB`;
    return `${teraByte.toFixed(2)} TB`;
  }
}
