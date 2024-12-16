import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { DraggableWindowComponent } from '@dialogs/draggable-window/draggable-window.component'

@NgModule({
    declarations: [DraggableWindowComponent],
    imports: [
        CommonModule,
        CdkDrag,
        CdkDragHandle,
    ],
    exports: [
        DraggableWindowComponent,
    ]
    })
export class DraggableWindowModule { }
