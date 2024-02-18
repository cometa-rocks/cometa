import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpInterceptor,
  HttpHandler,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { filter, map, tap } from 'rxjs/operators';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { Observable } from 'rxjs';
import { ErrorDialog } from '@dialogs/error/error.dialog';

@Injectable()
export class SuccessHandlerInterceptor implements HttpInterceptor {
  constructor(private _dialog: MatDialog) {}

  /**
   * This interceptor handles the following response testcase
   *  success: false,
   *  error: "An error occurred"
   * @param req HttpRequest<any>
   * @param next HttpHandler
   */
  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      // Filter by finished request, we are not interested in any other type
      filter(e => e.type !== 0),
      map((res: HttpResponse<any>) => {
        // Check if is JSON Error response
        if (this.isErrorResponse(res)) {
          const body = JSON.parse(res.body);
          // Add handled parameter to let the final subscriber
          // know any error is already handled here
          body.handled = true;
          return res.clone({ body: JSON.stringify(body) });
        }
        // Check if is Redirect response
        if (this.isRedirectResponse(res)) {
          const body = JSON.parse(res.body);
          // Redirect to provided URL
          location.href = body.url;
        }
        return res;
      }),
      tap((res: HttpResponse<any>) => {
        if (this.isErrorResponse(res)) {
          const errorDialogExists = this._dialog.getDialogById('error');
          // Open dialog for errors
          if (this.hasKeys(res.body, 'handled') && !errorDialogExists) {
            this._dialog.open(ErrorDialog, {
              id: 'error',
              data: res.body,
            });
          }
        }
      })
    );
  }

  /**
   * Checks if an object has multiple given keys
   * @param obj {any} Object
   * @param keys {string[]} Array of keys
   * @returns boolean
   */
  hasKeys(obj: any | string, ...keys: string[]): boolean {
    if (typeof obj === 'string') {
      obj = JSON.parse(obj);
    }
    return keys.filter(k => k in obj).length === keys.length;
  }

  /**
   * Used to determine if response contains JSON, is of type Success and contains a redirection
   * @param res {HttpResponse<any>} Response of network
   * @returns boolean
   */
  isRedirectResponse(res: HttpResponse<any>): boolean {
    // Check headers
    const hasJSONheader = res.headers
      .get('Content-Type')
      .includes('application/json');
    let hasValidJSON = false;
    let hasTypeRedirect = false;
    try {
      // Check JSON and keys
      hasValidJSON = this.hasKeys(res.body, 'success', 'type');
      const json = JSON.parse(res.body);
      hasTypeRedirect = json?.type === 'redirect' && json?.url;
    } catch (err) {}
    // Both checks must be true
    return hasJSONheader && hasValidJSON && hasTypeRedirect;
  }

  /**
   * Used to determine if response contains JSON, is of type Success and contains errors
   * @param res {HttpResponse<any>} Response of network
   * @returns boolean
   */
  isErrorResponse(res: HttpResponse<any>): boolean {
    // Check headers
    const hasJSONheader = res.headers
      .get('Content-Type')
      .includes('application/json');
    let hasValidJSON = false;
    try {
      // Check JSON and keys
      hasValidJSON = this.hasKeys(res.body, 'success', 'error');
    } catch (err) {}
    // Both checks must be true
    return hasJSONheader && hasValidJSON;
  }
}
