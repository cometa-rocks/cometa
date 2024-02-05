import { ChangeDetectionStrategy, Component, ElementRef, Inject, OnInit, ViewChild } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { ApiService } from "@services/api.service";
import { NgxJsonViewerModule } from "ngx-json-viewer";
import { EMPTY, Subject, debounceTime, distinctUntilChanged, switchMap } from "rxjs";
import { CommonModule } from '@angular/common';  
@Component({
    selector: 'json-viewer',
    templateUrl: './json-view.component.html',
    styleUrls: ['./json-view.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [NgxJsonViewerModule, MatButtonModule,CommonModule]
})
export class JsonViewerComponent implements OnInit {

    @ViewChild('jqResult') jq_result: ElementRef<HTMLTextAreaElement>;
    jq_filter$ = new Subject<string>();

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: any,
        public dialogRef: MatDialogRef<JsonViewerComponent>,
        private _api: ApiService
    ) {}

    ngOnInit(): void {
        this.jq_filter$.pipe(
            debounceTime(500),
            distinctUntilChanged(),
            switchMap(value => {
                if (value) {
                    return this._api.getParsedJQFilter(
                        value,
                        this.data.id
                    )
                } else {
                    this.jq_result.nativeElement.value = "";
                    return EMPTY
                }
        })).subscribe({
            next: body => {
                const parsedBody = JSON.parse((<any>body))
                this.jq_result.nativeElement.value = parsedBody.result
            },
            error: response => {
                console.log(response.error)
            }
        })
    }

    getJQResult(event: Event) {
        const filterValue = (event.target as HTMLTextAreaElement).value;
        this.jq_filter$.next(filterValue);
    }

    closeDialog() {
        this.dialogRef.close();
    }
}