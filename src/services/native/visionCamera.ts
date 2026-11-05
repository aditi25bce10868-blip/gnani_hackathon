// Lazy access to react-native-vision-camera (npm i react-native-vision-camera).
// Required inside try/catch so the app builds and runs before it is installed;
// the Camera tab then shows an "install" note instead of crashing.

import type { ComponentType, Ref } from 'react';

export interface CameraHandle {
  takePhoto(opts?: { flash?: 'off' | 'on' | 'auto' }): Promise<{ path: string; width: number; height: number }>;
}

export interface VisionCameraModule {
  readonly Camera: ComponentType<{
    ref?: Ref<CameraHandle>;
    style?: unknown;
    device: unknown;
    isActive: boolean;
    photo?: boolean;
  }>;
  useCameraDevice(position: 'back' | 'front'): unknown | undefined;
  useCameraPermission(): { hasPermission: boolean; requestPermission(): Promise<boolean> };
}

export function loadVisionCamera(): VisionCameraModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-vision-camera') as VisionCameraModule;
  } catch {
    return null;
  }
}
