import { ChangeDetectionStrategy, Component, Inject } from "@angular/core";
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialog as MatDialog } from '@angular/material/legacy-dialog';
import { NgxJsonViewerModule } from "ngx-json-viewer";

@Component({
    selector: 'json-viewer',
    template: '<h1>REST API CALL</h1><hr style="margin: 20px auto"><ngx-json-viewer [json]="data" [expanded]="false"></ngx-json-viewer>',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [NgxJsonViewerModule]
})
export class JsonViewerComponent {
    constructor(
        @Inject(MAT_DIALOG_DATA) public data: any
    ) {}
}