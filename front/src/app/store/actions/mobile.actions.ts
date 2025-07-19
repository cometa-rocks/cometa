/**
 * Mobile WebSocket Actions for mobile-list.component.ts
 * This actions manages mobile container status updates in real-time
 */

export interface MobileContainerUpdate {
  container_id: number;
  service_status: string;
  shared: boolean;
  hostname?: string;
  apk_file?: number[]; // Changed to array to match ManyToManyField
  isTerminating?: boolean;
  created_by?: number;
  department_id?: number;
}

export namespace MobileWebSockets {
  /**
   * @description A mobile container status has been updated
   * @param {MobileContainerUpdate} containerUpdate Container update information
   */
  export class ContainerStatusUpdate {
    static readonly type = '[MobileWebSockets] Container Status Update';
    constructor(public containerUpdate: MobileContainerUpdate) {}
  }

  /**
   * @description A mobile container has been shared/unshared
   * @param {number} container_id Container ID
   * @param {boolean} shared Shared status
   */
  export class ContainerSharedUpdate {
    static readonly type = '[MobileWebSockets] Container Shared Update';
    constructor(
      public container_id: number,
      public shared: boolean
    ) {}
  }

  /**
   * @description A mobile container has been started
   * @param {number} container_id Container ID
   * @param {string} hostname Container hostname
   */
  export class ContainerStarted {
    static readonly type = '[MobileWebSockets] Container Started';
    constructor(
      public container_id: number,
      public hostname: string
    ) {}
  }

  /**
   * @description A mobile container has been stopped/paused
   * @param {number} container_id Container ID
   */
  export class ContainerStopped {
    static readonly type = '[MobileWebSockets] Container Stopped';
    constructor(public container_id: number) {}
  }

  /**
   * @description A mobile container has been terminated
   * @param {number} container_id Container ID
   */
  export class ContainerTerminated {
    static readonly type = '[MobileWebSockets] Container Terminated';
    constructor(public container_id: number) {}
  }

  /**
   * @description A mobile container APK list has been updated
   * @param {number} container_id Container ID
   * @param {number[]} apk_file Updated APK file list
   */
  export class ContainerApkUpdate {
    static readonly type = '[MobileWebSockets] Container APK Update';
    constructor(
      public container_id: number,
      public apk_file: number[]
    ) {}
  }

  /**
   * @description Initialize mobile WebSocket connection
   */
  export class InitializeMobileWebSocket {
    static readonly type = '[MobileWebSockets] Initialize Connection';
  }

  /**
   * @description Cleanup mobile WebSocket connection
   */
  export class CleanupMobileWebSocket {
    static readonly type = '[MobileWebSockets] Cleanup Connection';
  }
} 