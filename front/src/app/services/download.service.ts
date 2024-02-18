import { HttpClient } from '@angular/common/http';
import { Injectable, Inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { API_BASE, API_URL } from 'app/tokens';

@Injectable()
export class DownloadService {
  constructor(
    private _http: HttpClient,
    @Inject(API_URL) public api: string,
    @Inject(API_BASE) public base: string,
    private _snack: MatSnackBar
  ) {}

  downloadFile(response, file: UploadedFile) {
    const downloading = this._snack.open(
      'Generating file to download, please be patient.',
      'OK',
      { duration: 1000 }
    );
    const blob = new Blob([this.base64ToArrayBuffer(response.body)], {
      type: file.mime,
    });
    this.downloadFileBlob(blob, file);
  }

  base64ToArrayBuffer(data: string) {
    let byteArray;
    try {
      byteArray = atob(data);
    } catch (DOMException) {
      byteArray = data;
    }
    const uint = new Uint8Array(byteArray.length);
    for (let i = 0; i < byteArray.length; i++) {
      let ascii = byteArray.charCodeAt(i);
      uint[i] = ascii;
    }
    return uint;
  }

  downloadFileBlob(blob: Blob, file: UploadedFile) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = file.name;
    link.click();
  }
}
