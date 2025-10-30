
export interface FilterState {
  brightness: number;
  contrast: number;
  saturate: number;
  hue: number;
  sepia: number;
}

export interface TextState {
  content: string;
  x: number;
  y: number;
  color: string;
  size: number;
  font: string;
  isDragging: boolean;
  dragOffsetX: number;
  dragOffsetY: number;
}

export interface ImageState {
  dataUrl: string;
  element: HTMLImageElement;
  mimeType: string;
}

export type Tool = 'adjust' | 'text' | 'crop' | 'ai-edit' | 'ai-generate';

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 'e' | 's' | 'w';

export interface CropState {
    x: number;
    y: number;
    width: number;
    height: number;
    isDragging: boolean;
    isResizing: boolean;
    resizeHandle: ResizeHandle | null;
}