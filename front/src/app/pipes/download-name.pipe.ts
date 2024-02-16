import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'downloadName',
  standalone: true,
})
export class DownloadNamePipe implements PipeTransform {
  /**
   * Sets the file removing any preceding path
   * @param {string} file File for download
   * @returns {string}
   */
  transform(file: string): string {
    return file.replace(/^.*[\\\/]/, '');
  }
}
