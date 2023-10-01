import { Directive, ElementRef, Inject, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { DOCUMENT } from '@angular/common';

/**
 * This directive purpose will be to transform any HTML element where it is injected
 * and attach it to the passed query selector as parameter
 * Created to avoid crazy code for guided tour
 * This directive will take the passed selector and take it's place (width, height and position)
 * only when it's available in the DOM
 */

@Directive({
    selector: '[attachTo]',
    standalone: true
})
export class AttachToDirective implements OnChanges, OnDestroy {

    /** Variable for holding the DOM observer in class */
    observer: MutationObserver;

    /** Input parameter coming from attachTo directive */
    @Input() attachTo: string

    constructor(
        private _ref: ElementRef<HTMLElement>,
        @Inject(DOCUMENT) public document: Document
    ) {
        // Create MutationObserver with domChanged as callback
        // Used .bind(this) because callback overwrites "this" context
        this.observer = new MutationObserver(this.domChanged.bind(this));
    }

    /**
     * Callback for MutationObserver
     */
    domChanged() {
        // Check document token exists
        if (this.document) {
            // Grab element which we should attach to
            const element = this.document.querySelector(this.attachTo);
            // Check if exists after last DOM change
            if (element) {
                // Take attached element properties
                const props = element.getBoundingClientRect();
                const customStyles: Partial<CSSStyleDeclaration> = {
                    width: `${props.width}px`,
                    height: `${props.height}px`,
                    top: `${props.top}px`,
                    left: `${props.left}px`,
                    position: 'fixed',
                    pointerEvents: 'none',
                    zIndex: '9999'
                }
                Object.assign(this._ref.nativeElement.style, customStyles);
            } else {
                // console.log('Element to attach to not found yet or no longer found, reverting element props...');
                Object.assign(this._ref.nativeElement.style, this.defaultStyles);
            }
        } else {
            // Document is not ready yet
        }
    }

    /**
     * Function executed every time parameter of attachTo changes (can be null)
     * @param changes 
     */
    ngOnChanges(changes: SimpleChanges) {
        // Check value of attachTo is filled
        if (changes.attachTo.currentValue) {
            // Initialize observer
            this.observer.observe(this.document.body, {
                childList: true,
                attributes: true,
                characterData: true,
                subtree: true,
            });
        } else {
            // Terminate observer
            this.observer.disconnect();
        }
    }

    /** Default attached element styles */
    defaultStyles: Partial<CSSStyleDeclaration> = {
        width: `0`,
        height: `0`,
        top: `0`,
        left: `0`,
        position: 'fixed'
    }

    /** Executed when attachTo directive is no longer used */
    ngOnDestroy() {
        // Terminate observer
        if (this.observer) this.observer.disconnect();
    }

}
