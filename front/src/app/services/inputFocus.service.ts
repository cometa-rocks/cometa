import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Service for managing input focus state across components.
 * 
 * This service provides a centralized way to track whether any input element
 * in the application currently has focus. Components can subscribe to focus
 * changes and react accordingly (e.g., hiding overlays, adjusting layouts,
 * disabling keyboard shortcuts, auto-saving edits).
 * 
 * ## Key Use Cases
 * 
 * ### 1. Edit Feature Dialog
 * The service is extensively used in the Edit Feature dialog (`edit-feature.component.ts`) 
 * to coordinate with the Step Editor component. When users focus on step input fields 
 * in the Step Editor, the service notifies the Edit Feature dialog, which can then:
 * - Show/hide AI guidance overlays
 * - Adjust UI layouts
 * - Handle focus-dependent behaviors
 * 
 * ### 2. Files Management
 * In the files management component, the service automatically saves edits when 
 * users click outside of editing cells, preventing data loss and improving UX.
 * 
 * ### 3. Header Component
 * The header component uses the service to disable keyboard shortcuts (P, F, M, C)
 * when any input is focused, preventing accidental actions during text input.
 * 
 * ### 4. Step Editor Integration
 * The Step Editor component (`step-editor.component.ts`) sends focus events to the 
 * service, enabling real-time coordination with parent components like Edit Feature.
 * 
 * ### 5. Other Components
 * - Chatbot: Manages focus for chat input fields
 * - User management dialogs: Handles form input focus
 * - Integration dialogs: Coordinates focus states
 * - Browser management: Manages browser configuration inputs
 * 
 * @example
 * ```typescript
 * // In a component
 * constructor(private inputFocusService: InputFocusService) {}
 * 
 * ngOnInit() {
 *   this.inputFocusService.inputFocus$.subscribe(hasFocus => {
 *     if (hasFocus) {
 *       // Handle input focus - e.g., disable keyboard shortcuts
 *       this.disableKeyboardShortcuts();
 *     } else {
 *       // Handle input blur - e.g., enable keyboard shortcuts, auto-save
 *       this.enableKeyboardShortcuts();
 *       this.autoSave();
 *     }
 *   });
 * }
 * 
 * // When an input gains focus
 * onInputFocus() {
 *   this.inputFocusService.setInputFocus(true);
 * }
 * 
 * // When an input loses focus
 * onInputBlur() {
 *   this.inputFocusService.setInputFocus(false);
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Auto-save on blur (like in files-management.component.ts)
 * this.inputFocusService.inputFocus$.subscribe((inputFocused) => {
 *   if (!inputFocused && this.editingCell) {
 *     this.saveEdit(
 *       this.editingCell.fileId,
 *       this.editingCell.rowIndex,
 *       this.editingCell.columnField
 *     );
 *   }
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Disable keyboard shortcuts when input is focused (like in header.component.ts)
 * @HostListener('document:keydown', ['$event']) 
 * handleKeyboardEvent(event: KeyboardEvent) {
 *   // If any input is focused, don't handle keyboard shortcuts
 *   if (this.inputFocus) return;
 *   
 *   // Handle keyboard shortcuts only when no input is focused
 *   switch (event.keyCode) {
 *     case KEY_CODES.P: // Profile shortcut
 *       this.openProfile();
 *       break;
 *   }
 * }
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class InputFocusService {
  /**
   * Private BehaviorSubject that holds the current focus state.
   * Initialized to false (no input focused).
   */
  private inputFocusSubject = new BehaviorSubject<boolean>(false);

  /**
   * Observable that components can subscribe to for focus state changes.
   * Emits true when any input gains focus, false when all inputs lose focus.
   */
  inputFocus$ = this.inputFocusSubject.asObservable();

  /**
   * Updates the current input focus state.
   * 
   * @param isFocused - Boolean indicating whether an input is currently focused
   */
  setInputFocus(isFocused: boolean): void {
    this.inputFocusSubject.next(isFocused);
  }
}