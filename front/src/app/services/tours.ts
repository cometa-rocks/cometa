
import { Injectable } from "@angular/core";
import { SharedActionsService } from "./shared-actions.service";

/** Empty function for previous or next */
function emptyFn () {};

/**
 * Here we describe all tour for co.meta
 * Usage: import { Tours } from "./tours"
 * this.joyride.startTour({ steps: Tours.x.map(x => x.name) })
 * NOTES:
 *  - When using a function on prev or next, please use () => {}
 *  - If the selector is found in another page use the name property with @, example: intro@search
 */
@Injectable()
export class Tours {

    constructor(
        private _sharedActions: SharedActionsService
    ) { }

    /**
     * Tour defintion with Create Feature
     * @param component HeaderComponent Required to access "this"
     */
    CreateFeature: Tour = {
        id: 'create_feature',
        name: 'Create feature',
        version: 2,
        description: 'This tour explains how to create a feature for beginners.',
        steps: [
            // Basic introduction of co.meta
            {
                name: 'intro',
                title: 'Welcome to co.meta!',
                description: 'I\'m here to assist you on how to create your first feature.',
                position: 'center',
                previousFn: emptyFn,
                nextFn: emptyFn
            },
            // Explain button for creating feature
            {
                name: 'create_feature_btn',
                title: 'Create feature',
                description: 'Use this button to create a feature.',
                attachTo: '.action-buttons .icon:nth-child(2)',
                position: 'bottom',
                previousFn: emptyFn,
                nextFn: () => this._sharedActions.openEditFeature()
            },
            // Explain create feature dialog
            {
                name: 'create_feature_popup',
                title: 'Feature dialog',
                description: 'A dialog will open with all the details about the new feature, including name, email options, which browsers to run it with, steps definitions, etc.',
                nextFn: emptyFn,
                previousFn: () => this._sharedActions._dialog.closeAll(),
                position: 'center'
            },
            // Explain to fill feature basic information
            {
                name: 'feature_info',
                title: 'Feature information',
                description: 'Here you have to introduce the basic information about the feature.',
                nextFn: emptyFn,
                previousFn: emptyFn,
                position: 'bottom',
                attachTo: '.edit-feature-panel .mat-expansion-panel:first-child'
            },
            // Explain to check continue on failure
            {
                name: 'feature_continue',
                title: 'Continue on failure',
                description: 'Check this if you want to continue the feature steps even on failing steps.',
                nextFn: emptyFn,
                previousFn: emptyFn,
                position: 'bottom',
                attachTo: '.edit-feature-panel [formcontrolname="continue_on_failure"]'
            },
            // Explain where to upload files
            {
                name: 'file_upload',
                title: 'Upload Files',
                description: 'Here you can upload files of your desire.',
                nextFn: emptyFn,
                previousFn: emptyFn,
                position: 'bottom',
                attachTo: '.edit-feature-panel .upload-file'
            },
            // Explain to select which browsers to run the feature with
            {
                name: 'feature_browsers',
                title: 'Feature browsers',
                description: 'There you mark which browsers you want to run this feature with.',
                nextFn: emptyFn,
                previousFn: emptyFn,
                position: 'top',
                attachTo: '.edit-feature-panel .mat-expansion-panel:nth-child(3)'
            },
            // Explain to fill the steps
            {
                name: 'feature_steps',
                title: 'Feature steps',
                description: 'Here you have to define your feature steps.',
                nextFn: emptyFn,
                previousFn: emptyFn,
                position: 'top',
                attachTo: '.edit-feature-panel .mat-expansion-panel:nth-child(4)'
            },
            // Explain to set the schedule
            {
                name: 'feature_schedule',
                title: 'Feature schedule',
                description: 'Lastly you can define the schedule, if not defined the feature will run only when you click Run.',
                nextFn: emptyFn,
                previousFn: emptyFn,
                position: 'top',
                attachTo: '.edit-feature-panel .mat-expansion-panel:nth-child(5)'
            },
            // Explain how to finally create the feature
            {
                name: 'feature_create',
                title: 'Submit feature',
                description: 'Once you have all specificed click CREATE to submit your feature.',
                nextFn: emptyFn,
                previousFn: emptyFn,
                position: 'top',
                attachTo: '.edit-feature-panel .submit'
            }
        ]
    }

}

export interface Tour {
    /** ID of tour */
    id: string;
    /** Name of tour */
    name: string;
    /** Description of tour */
    description: string;
    /** Version of tour */
    version: number;
    /** Defition of tour steps */
    steps: TourDefinition[];
}

export interface TourExtended extends Tour {
    completed: boolean;
}

export interface TourDefinition {
    /** Id or name of the step */
    name: string;
    /** A CSS selector to attach the step to */
    attachTo?: string;
    /** Where to position the tour box */
    position: string;
    /** This text will appear as title of the tour box */
    title: string;
    /** This text will appear as long text description inside the tour box */
    description: string;
    /** Used to provide an action when the prev button of the current step is clicked */
    previousFn: Function;
    /** Used to provide an action when the next button of the current step is clicked */
    nextFn: Function;
}