import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { API_URL, API_BASE } from 'app/tokens';
import { Observable, of } from 'rxjs';
import { filter, map, switchMap } from 'rxjs/operators';
import { encodeURLParams } from 'ngx-amvara-toolbox';
import { InterceptorParams } from 'ngx-network-error';
import { MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import {
  AreYouSureData,
  AreYouSureDialog,
} from '@dialogs/are-you-sure/are-you-sure.component';

@Injectable()
export class GraphService {
  constructor(
    private _http: HttpClient,
    private _dialog: MatDialog,
    @Inject(API_URL) public api: string,
    @Inject(API_BASE) public base: string
  ) {}

  /**
   * @description Save favourite browsers on the Backend for the current logged user
   * @author Anand Kushwaha
   * @usedIn UserState
   */
    getStepSummaryGraph(step_id, body) {
      return this._http.post(`${this.api}/reports/StepResultsGraph/${step_id}`, body);
    }

}
