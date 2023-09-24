import { InjectionToken } from '@angular/core';
import { CaptchaSettings } from './captcha-settings.interface';

export let CAPTCHA_SETTINGS = new InjectionToken<CaptchaSettings>(
  'captcha.settings'
);
