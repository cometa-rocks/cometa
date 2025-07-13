import { Injectable } from '@angular/core';
import { Action, Selector, State, StateContext } from '@ngxs/store';
import { MobileWebSockets, MobileContainerUpdate } from './actions/mobile.actions';

export interface MobileStateModel {
  containers: { [key: number]: MobileContainerUpdate };
  lastUpdate: number;
}

@State<MobileStateModel>({
  name: 'mobile',
  defaults: {
    containers: {},
    lastUpdate: 0
  }
})
@Injectable()
export class MobileState {
  @Selector()
  static getContainers(state: MobileStateModel) {
    return state.containers;
  }

  @Selector()
  static getContainerById(state: MobileStateModel) {
    return (containerId: number) => state.containers[containerId];
  }

  @Selector()
  static getLastUpdate(state: MobileStateModel) {
    return state.lastUpdate;
  }

  @Action(MobileWebSockets.ContainerStatusUpdate)
  containerStatusUpdate(
    ctx: StateContext<MobileStateModel>,
    action: MobileWebSockets.ContainerStatusUpdate
  ) {
    const state = ctx.getState();
    const { containerUpdate } = action;

    ctx.patchState({
      containers: {
        ...state.containers,
        [containerUpdate.container_id]: containerUpdate
      },
      lastUpdate: Date.now()
    });
  }

  @Action(MobileWebSockets.ContainerSharedUpdate)
  containerSharedUpdate(
    ctx: StateContext<MobileStateModel>,
    action: MobileWebSockets.ContainerSharedUpdate
  ) {
    console.log('[MOBILE STATE] ContainerSharedUpdate action received:', action);
    const state = ctx.getState();
    const { container_id, shared } = action;

    console.log('[MOBILE STATE] Current containers:', state.containers);
    const existingContainer = state.containers[container_id];
    if (existingContainer) {
      console.log('[MOBILE STATE] Updating existing container:', container_id, 'shared:', shared);
      ctx.patchState({
        containers: {
          ...state.containers,
          [container_id]: {
            ...existingContainer,
            shared
          }
        },
        lastUpdate: Date.now()
      });
      console.log('[MOBILE STATE] Container updated successfully');
    } else {
      console.log('[MOBILE STATE] Container not found in state, creating new entry:', container_id);
      ctx.patchState({
        containers: {
          ...state.containers,
          [container_id]: {
            container_id,
            shared,
            service_status: 'Unknown'
          }
        },
        lastUpdate: Date.now()
      });
    }
  }

  @Action(MobileWebSockets.ContainerStarted)
  containerStarted(
    ctx: StateContext<MobileStateModel>,
    action: MobileWebSockets.ContainerStarted
  ) {
    const state = ctx.getState();
    const { container_id, hostname } = action;

    const existingContainer = state.containers[container_id];
    if (existingContainer) {
      ctx.patchState({
        containers: {
          ...state.containers,
          [container_id]: {
            ...existingContainer,
            service_status: 'Running',
            hostname
          }
        },
        lastUpdate: Date.now()
      });
    }
  }

  @Action(MobileWebSockets.ContainerStopped)
  containerStopped(
    ctx: StateContext<MobileStateModel>,
    action: MobileWebSockets.ContainerStopped
  ) {
    const state = ctx.getState();
    const { container_id } = action;

    const existingContainer = state.containers[container_id];
    if (existingContainer) {
      ctx.patchState({
        containers: {
          ...state.containers,
          [container_id]: {
            ...existingContainer,
            service_status: 'Stopped'
          }
        },
        lastUpdate: Date.now()
      });
    }
  }

  @Action(MobileWebSockets.ContainerTerminated)
  containerTerminated(
    ctx: StateContext<MobileStateModel>,
    action: MobileWebSockets.ContainerTerminated
  ) {
    const state = ctx.getState();
    const { container_id } = action;

    const newContainers = { ...state.containers };
    delete newContainers[container_id];

    ctx.patchState({
      containers: newContainers,
      lastUpdate: Date.now()
    });
  }

  @Action(MobileWebSockets.ContainerApkUpdate)
  containerApkUpdate(
    ctx: StateContext<MobileStateModel>,
    action: MobileWebSockets.ContainerApkUpdate
  ) {
    const state = ctx.getState();
    const { container_id, apk_file } = action;

    const existingContainer = state.containers[container_id];
    if (existingContainer) {
      ctx.patchState({
        containers: {
          ...state.containers,
          [container_id]: {
            ...existingContainer,
            apk_file: apk_file // Now properly handling as array
          }
        },
        lastUpdate: Date.now()
      });
    }
  }

  @Action(MobileWebSockets.InitializeMobileWebSocket)
  initializeMobileWebSocket(ctx: StateContext<MobileStateModel>) {
    // This action can be used to initialize WebSocket connection
    // The actual WebSocket setup will be handled in the component
    console.log('Mobile WebSocket initialization requested');
  }

  @Action(MobileWebSockets.CleanupMobileWebSocket)
  cleanupMobileWebSocket(ctx: StateContext<MobileStateModel>) {
    // Clean up WebSocket connection and reset state
    ctx.setState({
      containers: {},
      lastUpdate: 0
    });
  }
} 