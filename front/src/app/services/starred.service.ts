/**
 * Service to manage starred features.
 * Provides functionality to add, remove and query favorites,
 * maintaining persistence in localStorage and notifying changes to subscribed components.
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { Store } from '@ngxs/store';
import { UserState } from '@store/user.state';

/**
 * Interface that defines the structure of events when a feature is starred/unstarred
 */
export interface StarredFeatureEvent {
  featureId: number;     // ID of the affected feature
  action: 'add' | 'remove';  // Type of action: add or remove from favorites
}

@Injectable({
  providedIn: 'root'  // Makes the service a singleton available throughout the app
})
export class StarredService {
  // Prefix for localStorage key, following project convention (co_)
  private readonly STORAGE_KEY_PREFIX = 'co_starred_features_user_';

  // BehaviorSubject maintains the current state of favorites (Set of IDs)
  // Set ensures there are no duplicate IDs
  private starredFeaturesSubject = new BehaviorSubject<Set<number>>(new Set());
  
  // Public Observable that other components can subscribe to receive updates
  public starredFeatures$ = this.starredFeaturesSubject.asObservable();

  // Current user ID
  private userId: number;

  // Subject to emit events when favorites are added/removed in real-time
  private starredChangesSubject = new BehaviorSubject<StarredFeatureEvent | null>(null);
  
  // Public Observable for other components to react to changes in favorites
  public starredChanges$ = this.starredChangesSubject.asObservable();

  constructor(private store: Store) {
    // Get user ID from store
    this.userId = this.store.selectSnapshot(UserState.GetUserId);
    // Load saved favorites when service initializes
    this.loadFromLocalStorage();
  }

  /**
   * Generates unique localStorage key by combining prefix and user ID
   */
  private get storageKey(): string {
    return `${this.STORAGE_KEY_PREFIX}${this.userId}`;
  }

  /**
   * Loads saved favorites from localStorage when service initializes
   * If there's an error parsing, initializes with an empty Set
   */
  private loadFromLocalStorage(): void {
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      try {
        const parsedData = JSON.parse(stored);
        if (Array.isArray(parsedData)) {
          // Filter to ensure only numbers are included
          const numberArray = parsedData.filter(item => typeof item === 'number');
          // Create new Set with IDs and update subject
          const features = new Set<number>(numberArray);
          this.starredFeaturesSubject.next(features);
        }
      } catch (error) {
        console.error('Error parsing starred features:', error);
        // If there's an error, initialize with empty Set
        this.starredFeaturesSubject.next(new Set());
      }
    }
  }

  /**
   * Saves favorites to localStorage
   * Converts Set to array before saving as JSON
   */
  private saveToLocalStorage(features: Set<number>): void {
    localStorage.setItem(this.storageKey, JSON.stringify(Array.from(features)));
  }

  /**
   * Toggles favorite status of a feature (adds or removes)
   * Updates state, saves to localStorage and emits change event
   */
  toggleStarred(featureId: number): void {
    const current = this.starredFeaturesSubject.value;
    const updated = new Set(current);
    const action = updated.has(featureId) ? 'remove' : 'add';
    
    if (action === 'remove') {
      updated.delete(featureId);  // Remove ID from Set
    } else {
      updated.add(featureId);     // Add ID to Set
    }

    // Update state and save to localStorage
    this.starredFeaturesSubject.next(updated);
    this.saveToLocalStorage(updated);
    
    // Emit change event
    this.starredChangesSubject.next({ featureId, action });
  }

  /**
   * Checks if a feature is marked as favorite
   * @returns Observable<boolean> that emits true if the feature is starred
   */
  isStarred(featureId: number): Observable<boolean> {
    return this.starredFeatures$.pipe(
      map(features => features.has(featureId))
    );
  }

  /**
   * Gets Observable with all favorite IDs
   * @returns Observable<Set<number>> with the set of IDs marked as favorites
   */
  getStarredFeatures(): Observable<Set<number>> {
    return this.starredFeatures$;
  }

  /**
   * Gets total number of favorites
   * @returns Observable<number> with the count of starred features
   */
  getStarredCount(): Observable<number> {
    return this.starredFeatures$.pipe(
      map(features => features.size)
    );
  }

  /**
   * Removes all favorites
   * Emits removal events for each feature and clears state
   */
  clearAllStarred(): void {
    const currentFeatures = this.starredFeaturesSubject.value;
    // Emit removal events for each feature
    currentFeatures.forEach(featureId => {
      this.starredChangesSubject.next({ featureId, action: 'remove' });
    });
    
    // Clear state and localStorage
    this.starredFeaturesSubject.next(new Set());
    this.saveToLocalStorage(new Set());
  }
} 