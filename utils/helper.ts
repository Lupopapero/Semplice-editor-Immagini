import { FilterState, TextState, ImageState } from '../types';

export const fileToDataUrl = (file: File): Promise<{ dataUrl: string, mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ dataUrl: reader.result as string, mimeType: file.type });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const loadImageElement = (dataUrl: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
};

export const drawCanvas = (
  canvas: HTMLCanvasElement,
  imageState: ImageState,
  filters: FilterState,
  text: TextState
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  canvas.width = imageState.element.naturalWidth;
  canvas.height = imageState.element.naturalHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) hue-rotate(${filters.hue}deg) sepia(${filters.sepia}%)`;
  ctx.drawImage(imageState.element, 0, 0, canvas.width, canvas.height);
  
  ctx.filter = 'none';

  if (text.content) {
    ctx.fillStyle = text.color;
    ctx.font = `${text.size}px ${text.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.content, text.x, text.y);
  }
};