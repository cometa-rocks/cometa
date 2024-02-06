
/**
 * Feature Result Actions for results.state.ts
 * This actions manages Live Steps and feature runs statuses
 */
export namespace WebSockets {

    /**
     * @description A feature has been queued
     * @param {number} feature_id Feature ID
     * @param {number} run_id Run ID
     * @param {number} feature_result_id Feature Result ID
     * @param {BrowserstackBrowser} browser_info Browser object
     * @param {string} datetime Current datetime
     */
    export class FeatureQueued {
        static readonly type = '[WebSockets] Feature Queued';
        constructor(
            public feature_id: number,
            public run_id: number,
            public feature_result_id: number,
            public browser_info: BrowserstackBrowser,
            public datetime: string
        ) { }
    }
       

    /**
     * @description A feature has just started initializing
     * @param {number} feature_id Feature ID
     * @param {number} run_id Run ID
     * @param {number} feature_result_id Feature Result ID
     * @param {BrowserstackBrowser} browser_info Browser object
     * @param {string} datetime Current datetime
     */
    export class FeatureInitializing {
        static readonly type = '[WebSockets] Initializing Feature';
        constructor(
            public feature_id: number,
            public run_id: number,
            public feature_result_id: number,
            public browser_info: BrowserstackBrowser,
            public datetime: string
        ) { }
    }

    /**
     * @description A feature has not received a WebSocket since the FeatureInitializing WebSocket
     * @param {number} feature_id Feature ID
     */
    export class RunTimeout {
        static readonly type = '[WebSockets] Run Timeout';
        constructor(
            public feature_id: number,
            public run_id: number,
            public browser_info: BrowserstackBrowser
        ) { }
    }

    /**
     * @description Creates a new empty run with queued status
     * @param {number} feature_id Feature ID
     */
    export class FeatureTaskQueued {
        static readonly type = '[WebSockets] Feature task queued';
        constructor( public feature_id: number ) { }
    }

    /**
     * @description Indicates a Feature run has just started the testing
     * @param {number} feature_id Feature ID
     * @param {number} run_id Run ID
     * @param {number} feature_result_id Feature Result ID
     * @param {BrowserstackBrowser} browser_info Browser object
     * @param {string} datetime Current datetime
     */
    export class FeatureStarted {
        static readonly type = '[WebSockets] Started Feature';
        constructor(
            public feature_id: number,
            public run_id: number,
            public feature_result_id: number,
            public start_at: string,
            public browser_info: BrowserstackBrowser,
            public datetime: string
        ) { }
    }

    /**
     * @description Indicates a step has just started
     * @param {number} feature_id Feature ID
     * @param {number} run_id Run ID
     * @param {number} feature_result_id Feature Result ID
     * @param {BrowserstackBrowser} browser_info Browser object
     * @param {string} step_name Step name
     * @param {number} step_index Index of step within all steps of feature
     * @param {string} datetime Current datetime
     */
    export class StepStarted {
        static readonly type = '[WebSockets] Started Step';
        constructor(
            public feature_id: number,
            public run_id: number,
            public feature_result_id: number,
            public browser_info: BrowserstackBrowser,
            public step_name: string,
            public step_index: number,
            public datetime: string
        ) { }
    }

    /**
     * @description Indicates a step has some dest
     * @param {number} feature_id Feature ID
     * @param {number} run_id Run ID
     * @param {number} feature_result_id Feature Result ID
     * @param {BrowserstackBrowser} browser_info Browser object
     * @param {number} step_index Index of step within all steps of feature
     * @param {string} datetime Current datetime
     */
    export class StepDetailedInfo {
        static readonly type = '[WebSockets] Step Detailed Info';
        constructor(
            public feature_id: number,
            public run_id: number,
            public browser_info: BrowserstackBrowser,
            public step_index: number,
            public datetime: string,
            public info: string
        ) { }
    }

    /**
     * @description Indicates a step has just finished
     * @param {number} feature_id Feature ID
     * @param {number} run_id Run ID
     * @param {number} feature_result_id Feature Result ID
     * @param {BrowserstackBrowser} browser_info Browser object
     * @param {string} step_name Step name
     * @param {number} step_index Index of step within all steps of feature
     * @param {StepResult} step_result_info StepResult object
     * @param {string} error Optional error text
     * @param {number} step_time Execution duration of step
     * @param {string} datetime Current datetime
     * @param {number} vulnerable_headers_count vulnerable_headers_count
     */
    export class StepFinished {
        static readonly type = '[WebSockets] Finished Step';
        constructor(
            public feature_id: number,
            public run_id: number,
            public feature_result_id: number,
            public browser_info: BrowserstackBrowser,
            public step_name: string,
            public step_index: number,
            public step_result_info: StepResult,
            public error: string,
            public step_time: number,
            public datetime: string,
            public screenshots: any,
            public vulnerable_headers_count:number
        ) { 
        }
    }

    /**
     * @description Indicates a Feature has just finished
     * @param {number} feature_id Feature ID
     * @param {number} run_id Run ID
     * @param {number} feature_result_id Feature Result ID
     * @param {BrowserstackBrowser} browser_info Browser object
     * @param {FeatureResult} feature_result_info Feature Result Info object
     * @param {string} datetime Current datetime
     */
    export class FeatureFinished {
        static readonly type = '[WebSockets] Finished Feature';
        constructor(
            public feature_id: number,
            public run_id: number,
            public feature_result_id: number,
            public browser_info: BrowserstackBrowser,
            public feature_result_info: FeatureResult,
            public datetime: string
        ) {
         }
    }

    /**
     * @description Indicates a Feature run has just completed
     * @param {number} feature_id Feature ID
     * @param {number} run_id Run ID
     * @param {string} datetime Current datetime
     */
    export class FeatureRunCompleted {
        static readonly type = '[WebSockets] Completed Feature Run';
        constructor(
            public feature_id: number,
            public run_id: number,
            public datetime: string
        ) { }
    }

    /**
     * @description Action received manually to tell the given run it's completed after the stop
     * @param {number} feature_id Feature ID
     * @param {number} run_id Run ID
     */
    export class StoppedFeature {
        static readonly type = '[WebSockets] Stopped Feature';
        constructor(
            public feature_id: number,
            public run_id: number
        ) { }
    }

    /**
     * @description Indicates a generic Error has happened when executing a Feature
     * @param {number} feature_id Feature ID
     * @param {number} run_id Run ID
     * @param {number} feature_result_id Feature Result ID
     * @param {BrowserstackBrowser} browser_info Browser object
     * @param {FeatureResult} feature_result_info Feature Result Info object
     * @param {string} error Error text
     * @param {string} datetime Current datetime
     */
    export class FeatureError {
        static readonly type = '[WebSockets] Feature Error';
        constructor(
            public feature_id: number,
            public run_id: number,
            public feature_result_id: number,
            public browser_info: BrowserstackBrowser,
            public feature_result_info: FeatureResult,
            public error: string,
            public datetime: string
        ) { }
    }

    /**
     * @description Loads the notification IDs in localStorage
     */
    export class Load {
        static readonly type = '[WebSockets] Load';
    }

    /**
     * @description Adds a FeatureID to the notifications array
     * @param {number} feature_id Feature ID
     */
    export class AddNotificationID {
        static readonly type = '[Notification] Add Id';
        constructor ( public feature_id: number ) { }
    }

    /**
     * @description Removes a FeatureID from notifications array
     * @param {number} feature_id Feature ID
     */
    export class RemoveNotificationID {
        static readonly type = '[Notification] Remove Id';
        constructor ( public feature_id: number ) { }
    }

    /**
     * @description Cleanup feature results for finished runs
     * @param {number} feature_id Feature ID
     */
    export class CleanupFeatureResults {
        static readonly type = '[Notification] Cleanup feature results';
        constructor ( public feature_id: number ) { }
    }
}