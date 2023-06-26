import { Injectable } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { MatLegacySnackBar as MatSnackBar, MatLegacySnackBarRef as MatSnackBarRef } from '@angular/material/legacy-snack-bar';
import { LoadingSnack } from '@components/snacks/loading/loading.snack';
import { TranslateService } from '@ngx-translate/core';

@Injectable()
export class LoadingInterceptor implements HttpInterceptor {

    timer: NodeJS.Timeout;

    snackRef: MatSnackBarRef<LoadingSnack>;

    constructor(
        private _snackBar: MatSnackBar,
        private _translate: TranslateService
    ) { }

    /**
     * This interceptor handles the loading of backend resources
     * @param req HttpRequest<any>
     * @param next HttpHandler
     */
    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        let loading = req.params.get('loading');
        // Check if dev provided loading text
        if (loading) {
            // Remove parameter from request
            const request = req.clone({
                params: req.params.delete('loading')
            });
            // Clear previously set timer
            if (this.timer) {
                clearTimeout(this.timer);
            }
            // Handle translate: prefix
            if (loading.startsWith('translate:')) {
                loading = this._translate.instant(loading.split(':')[1])
            }
            // Set timer with show progress notification
            this.timer = setTimeout(() => this.showLoading(loading), 150);
    
            return next.handle(request).pipe(
                finalize(() => {
                    // Hide notification and lcear timer
                    this.hideLoading();
                    if (this.timer) {
                        clearTimeout(this.timer);
                    }
                })
            );
        }
        return next.handle(req);
    }

    showLoading(text: string) {
        if (this.snackRef) {
            this.snackRef.instance.text = text;
        } else {
            this.snackRef = this._snackBar.openFromComponent(LoadingSnack, { data: text, duration: 999999, panelClass: 'loading-snack-panel' })
        }
    }

    hideLoading() {
        if (this.snackRef) {
            this.snackRef.dismiss();
            this.snackRef = null;
        }
    }
}
