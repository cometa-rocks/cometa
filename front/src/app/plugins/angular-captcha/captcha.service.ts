import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { CaptchaEndpointPipe } from './captcha-endpoint.pipe';
import { CaptchaSettings } from './captcha-settings.interface';
import { CAPTCHA_SETTINGS } from './config';

declare var BotDetect: any;

@Injectable()
export class CaptchaService {
  private _captchaStyleName: string;
  private _captchaEndpoint: string;

  constructor(
    private http: HttpClient,
    private captchaEndpointPipe: CaptchaEndpointPipe,
    @Inject(CAPTCHA_SETTINGS) private config: CaptchaSettings
  ) {}

  set captchaStyleName(captchaStyleName: string) {
    this._captchaStyleName = captchaStyleName;
  }

  get captchaStyleName(): string {
    return this._captchaStyleName;
  }

  set captchaEndpoint(captchaEndpoint: string) {
    this._captchaEndpoint = captchaEndpoint;
  }

  // the captcha endpoint for botdetect requests.
  get captchaEndpoint(): string {
    let captchaEndpoint = this._captchaEndpoint;
    if (this.config && this.config.captchaEndpoint) {
      captchaEndpoint = this.config.captchaEndpoint;
    }
    return this.captchaEndpointPipe.transform(captchaEndpoint);
  }

  // get botdetect instance, which is provided by botdetect script.
  get botdetectInstance(): any {
    return BotDetect.getInstanceByStyleName(this.captchaStyleName);
  }

  // get captcha html markup from botdetect api.
  getHtml(): any {
    if (!this.captchaEndpoint) {
      const errorMessage = `captchaEndpoint property is not set!
    The Angular Captcha Module requires the "this.captchaComponent.captchaEndpoint" property to be set.
    For example: 
    ngOnInit(): void {
      this.captchaComponent.captchaEndpoint = 'https://your-app-backend-hostname.your-domain.com/simple-captcha-endpoint-path';
    }
      `;
      throw new Error(errorMessage);
    }

    const url = this.captchaEndpoint + '?get=html&c=' + this.captchaStyleName;
    return this.http.get(url, { responseType: 'text' });
  }

  // ui validate captcha.
  validateUnsafe(captchaCode: string): any {
    if (!this.botdetectInstance) {
      throw new Error('BotDetect instance does not exist.');
    }
    const url = this.botdetectInstance.validationUrl + '&i=' + captchaCode;
    return this.http.get(url);
  }
}
