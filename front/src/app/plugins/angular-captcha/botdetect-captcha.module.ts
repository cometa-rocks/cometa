import { NgModule, ModuleWithProviders } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';

import { CaptchaComponent } from './captcha.component';
import { CaptchaService } from './captcha.service';
import { CaptchaHelperService } from './captcha-helper.service';
import { CorrectCaptchaDirective } from './correct-captcha.directive';
import { CaptchaEndpointPipe } from './captcha-endpoint.pipe';
import { CaptchaSettings } from './captcha-settings.interface';
import { CAPTCHA_SETTINGS } from './config';

@NgModule({
  imports: [
    HttpClientModule
  ],
  declarations: [
    CaptchaEndpointPipe,
    CaptchaComponent,
    CorrectCaptchaDirective
  ],
  providers: [
    CaptchaService,
    CaptchaHelperService,
    CaptchaEndpointPipe,
    {
      // we need this provide CAPTCHA_SETTINGS declaration
      // since we have added support for the captchaEndpoint 
      // setting in component
      provide: CAPTCHA_SETTINGS,
      useValue: null
    }
  ],
  exports: [
    CaptchaComponent,
    CorrectCaptchaDirective
  ]
})
export class BotDetectCaptchaModule {

  static forRoot(config: CaptchaSettings): ModuleWithProviders<BotDetectCaptchaModule> {
    return {
      ngModule: BotDetectCaptchaModule,
      providers: [provideBotDetectCaptcha(config)]
    };
  }

  static forChild(config: CaptchaSettings): ModuleWithProviders<BotDetectCaptchaModule> {
    return {
      ngModule: BotDetectCaptchaModule,
      providers: [provideBotDetectCaptcha(config)]
    };
  }
}

export function provideBotDetectCaptcha(config: CaptchaSettings): any {
  return [
    {
      provide: CAPTCHA_SETTINGS,
      useValue: config
    }
  ];
}
