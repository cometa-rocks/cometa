import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ApiService } from '@services/api.service';

@Pipe({
  name: 'downloadLink',
})
export class DownloadLinkPipe implements PipeTransform {
  constructor(
    private _sanitizer: DomSanitizer,
    private _api: ApiService
  ) {}

  /**
   * Sanitizes and sets the backend URL to download file
   * @param {string} file File for download
   * @returns {SafeUrl}
   */
  transform(file: string): SafeUrl {
    return this._sanitizer.bypassSecurityTrustUrl(
      `${this._api.base}download/${file}/`
    );
  }
}
