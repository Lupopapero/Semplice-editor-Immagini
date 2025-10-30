import React, { useRef, useEffect, useCallback } from 'react';
import { ImageState, FilterState, TextState, CropState, ResizeHandle, Tool } from '../types';
import { drawCanvas } from '../utils/helper';

const HANDLE_SIZE = 10; // In pixels on the scaled canvas

interface ImageCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  imageState: ImageState;
  filters: FilterState;
  textState: TextState;
  setTextState: React.Dispatch<React.SetStateAction<TextState>>;
  onCommit?: () => void;
  activeTool: Tool;
  cropState: CropState | null;
  setCropState: React.Dispatch<React.SetStateAction<CropState | null>>;
}

const ImageCanvas: React.FC<ImageCanvasProps> = ({
  canvasRef,
  imageState,
  filters,
  textState,
  setTextState,
  onCommit,
  activeTool,
  cropState,
  setCropState
}) => {
  const textMetricsRef = useRef<TextMetrics | null>(null);
  const interactionState = useRef({ startX: 0, startY: 0, startCropState: null as CropState | null }).current;
  
  const getCanvasAndContext = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    return { canvas, ctx };
  }
  
  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
    };
  };

  const drawCropOverlay = useCallback(() => {
    const { canvas, ctx } = getCanvasAndContext();
    if (!canvas || !ctx || !cropState) return;
    
    // Draw crop border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cropState.x, cropState.y, cropState.width, cropState.height);

    // Draw handles
    const { x, y, width, height } = cropState;
    const handles = {
        nw: { x: x, y: y }, ne: { x: x + width, y: y },
        sw: { x: x, y: y + height }, se: { x: x + width, y: y + height },
        n: { x: x + width / 2, y: y }, e: { x: x + width, y: y + height / 2 },
        s: { x: x + width / 2, y: y + height }, w: { x: x, y: y + height / 2 },
    };
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    const handlePixelSize = HANDLE_SIZE / (canvasRef.current?.getBoundingClientRect().width / canvasRef.current?.width || 1);

    Object.values(handles).forEach(pos => {
        ctx.fillRect(pos.x - handlePixelSize / 2, pos.y - handlePixelSize / 2, handlePixelSize, handlePixelSize);
    });

  }, [cropState]);
  
  useEffect(() => {
    const { canvas } = getCanvasAndContext();
    if (canvas) {
      drawCanvas(canvas, imageState, filters, textState);
      if (activeTool === 'crop') {
        drawCropOverlay();
      }
    }
  }, [imageState, filters, textState, canvasRef, activeTool, cropState, drawCropOverlay]);


  // Text Dragging Logic
  const getTextBoundingBox = useCallback(() => {
    const { ctx } = getCanvasAndContext();
    if (!ctx || !textState.content) return null;

    ctx.font = `${textState.size}px ${textState.font}`;
    const metrics = ctx.measureText(textState.content);
    textMetricsRef.current = metrics;
    
    const width = metrics.width;
    const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    
    const x = textState.x - width / 2;
    const y = textState.y - height / 2;
    
    return { x, y, width, height };
  }, [textState]);
  
  // Crop Interaction Logic
  const getHandleAtPosition = (mouseX: number, mouseY: number): ResizeHandle | null => {
    const { canvas } = getCanvasAndContext();
    if (!cropState || !canvas) return null;
    const { x, y, width, height } = cropState;
     const handlePixelSize = HANDLE_SIZE / (canvasRef.current?.getBoundingClientRect().width / canvasRef.current?.width || 1);

    const handles = {
        nw: { x: x, y: y }, ne: { x: x + width, y: y },
        sw: { x: x, y: y + height }, se: { x: x + width, y: y + height },
        n: { x: x + width / 2, y: y }, e: { x: x + width, y: y + height / 2 },
        s: { x: x + width / 2, y: y + height }, w: { x: x, y: y + height / 2 },
    };
    
    for (const [key, pos] of Object.entries(handles)) {
        if ( Math.abs(mouseX - pos.x) < handlePixelSize && Math.abs(mouseY - pos.y) < handlePixelSize ) {
            return key as ResizeHandle;
        }
    }
    return null;
  };

  const getCursor = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool !== 'crop' || !cropState) return 'default';
    const { x: mouseX, y: mouseY } = getMousePos(e);
    const handle = getHandleAtPosition(mouseX, mouseY);
    if (handle) {
        if (handle === 'n' || handle === 's') return 'ns-resize';
        if (handle === 'e' || handle === 'w') return 'ew-resize';
        if (handle === 'nw' || handle === 'se') return 'nwse-resize';
        if (handle === 'ne' || handle === 'sw') return 'nesw-resize';
    }
    if ( mouseX > cropState.x && mouseX < cropState.x + cropState.width && mouseY > cropState.y && mouseY < cropState.y + cropState.height ) {
        return 'move';
    }
    return 'crosshair';
  };

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x: mouseX, y: mouseY } = getMousePos(e);
    interactionState.startX = mouseX;
    interactionState.startY = mouseY;
    
    if (activeTool === 'crop') {
        if (!cropState) return;
        interactionState.startCropState = { ...cropState };
        const handle = getHandleAtPosition(mouseX, mouseY);
        if (handle) {
            setCropState(prev => prev ? ({ ...prev, isResizing: true, resizeHandle: handle }) : null);
        } else if (mouseX > cropState.x && mouseX < cropState.x + cropState.width && mouseY > cropState.y && mouseY < cropState.y + cropState.height) {
            setCropState(prev => prev ? ({ ...prev, isDragging: true }) : null);
        } else {
            // Start drawing new crop area
            setCropState({ x: mouseX, y: mouseY, width: 0, height: 0, isResizing: true, resizeHandle: 'se', isDragging: false });
        }
    } else {
        const bbox = getTextBoundingBox();
        if (bbox && mouseX > bbox.x && mouseX < bbox.x + bbox.width && mouseY > bbox.y && mouseY < bbox.y + bbox.height) {
            setTextState(prev => ({
                ...prev,
                isDragging: true,
                dragOffsetX: mouseX - prev.x,
                dragOffsetY: mouseY - prev.y,
            }));
        }
    }
  }, [activeTool, getTextBoundingBox, setTextState, cropState, setCropState]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { canvas } = getCanvasAndContext();
    if (canvas) e.currentTarget.style.cursor = getCursor(e);

    if (activeTool === 'crop' && cropState) {
        if (!cropState.isDragging && !cropState.isResizing) return;
        
        const { x: mouseX, y: mouseY } = getMousePos(e);
        const { startX, startY, startCropState: startState } = interactionState;
        if (!startState) return;

        let { x, y, width, height } = startState;
        const dx = mouseX - startX;
        const dy = mouseY - startY;

        if (cropState.isResizing) {
            switch (cropState.resizeHandle) {
                case 'nw':
                    x = mouseX; y = mouseY;
                    width = startState.width - dx; height = startState.height - dy;
                    break;
                case 'ne':
                    y = mouseY;
                    width = mouseX - startState.x; height = startState.height - dy;
                    break;
                case 'sw':
                    x = mouseX;
                    width = startState.width - dx; height = mouseY - startState.y;
                    break;
                case 'se':
                    width = mouseX - startState.x; height = mouseY - startState.y;
                    break;
                case 'n':
                    y = mouseY;
                    height = startState.height - dy;
                    break;
                case 's':
                    height = mouseY - startState.y;
                    break;
                case 'w':
                    x = mouseX;
                    width = startState.width - dx;
                    break;
                case 'e':
                    width = mouseX - startState.x;
                    break;
            }
            if (width < 0) { x += width; width = Math.abs(width); }
            if (height < 0) { y += height; height = Math.abs(height); }

            setCropState(prev => prev ? ({ ...prev, x, y, width, height }) : null);
        } else if (cropState.isDragging) {
            setCropState(prev => prev ? ({ ...prev, x: startState.x + dx, y: startState.y + dy }) : null);
        }
    } else if (textState.isDragging) {
        const { x: mouseX, y: mouseY } = getMousePos(e);
        setTextState(prev => ({
            ...prev,
            x: mouseX - prev.dragOffsetX,
            y: mouseY - prev.dragOffsetY,
        }));
    }
  }, [textState.isDragging, setTextState, activeTool, cropState, setCropState]);

  const handleMouseUpOrLeave = useCallback(() => {
    if (activeTool === 'crop' && cropState && (cropState.isDragging || cropState.isResizing)) {
        setCropState(prev => {
            if (!prev) return null;
            let { x, y, width, height } = prev;
            // Normalize negative width/height
            if (width < 0) { x += width; width = Math.abs(width); }
            if (height < 0) { y += height; height = Math.abs(height); }
            return { ...prev, x, y, width, height, isDragging: false, isResizing: false, resizeHandle: null };
        });
    }

    if (textState.isDragging) {
        setTextState(prev => ({ ...prev, isDragging: false }));
        onCommit?.();
    }
  }, [textState.isDragging, setTextState, onCommit, activeTool, cropState, setCropState]);
  
  return (
    <canvas
      ref={canvasRef}
      className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUpOrLeave}
      onMouseLeave={handleMouseUpOrLeave}
    />
  );
};

export default ImageCanvas;