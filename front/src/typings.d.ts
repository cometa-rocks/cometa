/* SystemJS module definition */
declare var module: NodeModule;
interface NodeModule {
  id: string;
}

/* ngx-network-error module declaration */
declare module 'ngx-network-error' {
  import { ModuleWithProviders } from '@angular/core';
  import { HttpParams } from '@angular/common/http';

  export interface RequestParams {
    skipInterceptor?: boolean;
    silent?: boolean;
    ignoreDiskCache?: boolean;
    ignoreServiceWorkerCache?: boolean;
    ignoreProxyCache?: boolean;
    important?: boolean;
    retry?: any;
    contentChecks?: any;
    [key: string]: any;
  }

  export class InterceptorParams extends HttpParams {
    constructor(
      requestParams: RequestParams,
      params?: { [param: string]: string | string[] }
    );
    requestParams: RequestParams;
  }

  export interface NgxNetworkErrorConfig {
    authType?: string;
    reporting?: {
      sentryDSN?: string;
      ignoreErrors?: string[];
    };
    [key: string]: any;
  }

  export class NgxNetworkErrorModule {
    static forRoot(config?: NgxNetworkErrorConfig): ModuleWithProviders<NgxNetworkErrorModule>;
  }
}
