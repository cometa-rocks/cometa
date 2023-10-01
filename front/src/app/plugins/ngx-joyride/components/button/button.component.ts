import { Component, Input, EventEmitter, Output } from "@angular/core";
import { NgStyle } from "@angular/common";

@Component({
    selector: 'joyride-button',
    templateUrl: './button.component.html',
    styleUrls: ['./button.component.scss'],
    standalone: true,
    imports: [NgStyle]
})
export class JoyrideButtonComponent {
    hover: boolean;
    
    @Input() 
    color: string;
    
    @Output()
    clicked: EventEmitter<any> = new EventEmitter();

    onClick() {
        this.clicked.emit();
    }
}