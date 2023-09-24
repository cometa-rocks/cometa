import { Component, Input, OnInit, ElementRef } from '@angular/core';

import { CaptchaService } from './captcha.service';
import { CaptchaHelperService } from './captcha-helper.service';

@Component({
  selector: 'botdetect-captcha',
  template: '',
})
export class CaptchaComponent implements OnInit {
  @Input() styleName: string; // backward compatible
  @Input() captchaStyleName: string;

  constructor(
    private elementRef: ElementRef,
    private captchaService: CaptchaService,
    private captchaHelper: CaptchaHelperService
  ) {}

  // provide captchaEndpoint for getting captcha challenge.
  set captchaEndpoint(captchaEndpoint: string) {
    this.captchaService.captchaEndpoint = captchaEndpoint;
  }

  // the current captcha id, which will be used for validation purpose.
  get captchaId(): string {
    return this.captchaService.botdetectInstance.captchaId;
  }

  // the user entered captcha code value.
  // keep this method for backward compatibility
  get captchaCode(): string {
    return this.captchaService.botdetectInstance.userInput.value;
  }

  get userEnteredCaptchaCode(): string {
    return this.captchaCode;
  }

  // display captcha html markup on component initialization.
  ngOnInit(): void {
    this.captchaStyleName = this.getCaptchaStyleName();

    // set captcha style name to CaptchaService for creating BotDetect object
    this.captchaService.captchaStyleName = this.captchaStyleName;

    // display captcha html markup on view
    this.displayHtml();
  }

  // get captcha style name.
  getCaptchaStyleName(): string {
    let styleName;

    styleName = this.captchaStyleName;
    if (styleName) {
      return styleName;
    }

    // backward compatible
    styleName = this.styleName;
    if (styleName) {
      return styleName;
    }

    throw new Error(
      'The captchaStyleName attribute is not found or its value is not set.'
    );
  }

  // display captcha html markup in the <botdetect-captcha> tag.
  displayHtml(): void {
    this.captchaService.getHtml().subscribe(
      (captchaHtml: string) => {
        // display captcha html markup
        captchaHtml = this.captchaHelper.changeRelativeToAbsoluteUrls(
          captchaHtml,
          this.captchaService.captchaEndpoint
        );
        this.elementRef.nativeElement.innerHTML = captchaHtml;

        // load botdetect scripts
        this.loadScriptIncludes();
      },
      (error: any) => {
        throw new Error(error);
      }
    );
  }

  // reload a new captcha image.
  reloadImage(): void {
    this.captchaService.botdetectInstance.reloadImage();
  }

  // validate captcha on client-side and execute user callback function on ajax success
  validateUnsafe(callback: (isHuman: boolean) => void): void {
    let userInput = this.captchaService.botdetectInstance.userInput;
    let captchaCode = userInput.value;
    if (captchaCode.length !== 0) {
      this.captchaService.validateUnsafe(captchaCode).subscribe(
        (isHuman: boolean) => {
          callback(isHuman);
          if (
            !this.captchaHelper.useUserInputBlurValidation(userInput) &&
            !isHuman
          ) {
            this.reloadImage();
          }
        },
        (error: any) => {
          throw new Error(error);
        }
      );
    } else {
      const isHuman = false;
      callback(isHuman);
    }
  }

  // load botdetect scripts.
  loadScriptIncludes(): void {
    let captchaId = this.elementRef.nativeElement.querySelector(
      '#BDC_VCID_' + this.captchaStyleName
    ).value;
    const scriptIncludeUrl =
      this.captchaService.captchaEndpoint +
      '?get=script-include&c=' +
      this.captchaStyleName +
      '&t=' +
      captchaId +
      '&cs=201';
    this.captchaHelper.getScript(scriptIncludeUrl);
  }
}
