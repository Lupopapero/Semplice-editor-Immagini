
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FilterState, TextState, ImageState, Tool, AspectRatio, CropState } from './types';
import { fileToDataUrl, loadImageElement, drawCanvas } from './utils/helper';
import { editImageWithGemini, generateImageWithImagen, getOptimalFilters } from './services/geminiService';
import ImageCanvas from './components/ImageCanvas';
import FileUploader from './components/FileUploader';
import PresetFilters from './components/PresetFilters';
import { 
    AdjustmentsIcon, TextIcon, SparklesIcon, MagicWandIcon, 
    DownloadIcon, ResetIcon, SunIcon, MoonIcon, UploadIcon,
    UndoIcon, RedoIcon, CropIcon
} from './components/icons';

const INITIAL_FILTERS: FilterState = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  hue: 0,
  sepia: 0,
};

const INITIAL_TEXT: TextState = {
  content: 'Il tuo testo qui',
  x: 250,
  y: 100,
  color: '#FFFFFF',
  size: 48,
  font: 'Arial',
  isDragging: false,
  dragOffsetX: 0,
  dragOffsetY: 0,
};

interface HistoryState {
    filters: FilterState;
    textState: TextState;
    image: ImageState;
}

const App: React.FC = () => {
    const [originalImage, setOriginalImage] = useState<ImageState | null>(null);
    const [currentImage, setCurrentImage] = useState<ImageState | null>(null);
    const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
    const [textState, setTextState] = useState<TextState>(INITIAL_TEXT);
    const [activeTool, setActiveTool] = useState<Tool>('adjust');
    const [cropState, setCropState] = useState<CropState | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [generatePrompt, setGeneratePrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
    const [error, setError] = useState<string | null>(null);
    const [downloadFilename, setDownloadFilename] = useState('edited-image');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    const [history, setHistory] = useState<HistoryState[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    useEffect(() => {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setIsDarkMode(true);
        }
    }, []);

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDarkMode]);
    
    const saveState = useCallback((newState: HistoryState) => {
        const newHistory = history.slice(0, historyIndex + 1);
        setHistory([...newHistory, newState]);
        setHistoryIndex(newHistory.length);
    }, [history, historyIndex]);
    
    const commitChanges = useCallback(() => {
        if (!currentImage) return;
        saveState({ filters, textState, image: currentImage });
    }, [filters, textState, currentImage, saveState]);
    
    const switchTool = (tool: Tool) => {
        setActiveTool(tool);
        if (tool === 'crop' && currentImage) {
            const { naturalWidth: w, naturalHeight: h } = currentImage.element;
            // Initialize crop area to 80% of image size, centered
            setCropState({
                x: w * 0.1,
                y: h * 0.1,
                width: w * 0.8,
                height: h * 0.8,
                isDragging: false,
                isResizing: false,
                resizeHandle: null,
            });
        } else {
            setCropState(null);
        }
    };

    const handleUndo = () => {
        if (historyIndex <= 0) return;
        const newIndex = historyIndex - 1;
        const stateToRestore = history[newIndex];
        setFilters(stateToRestore.filters);
        setTextState(stateToRestore.textState);
        setCurrentImage(stateToRestore.image);
        setHistoryIndex(newIndex);
    };

    const handleRedo = () => {
        if (historyIndex >= history.length - 1) return;
        const newIndex = historyIndex + 1;
        const stateToRestore = history[newIndex];
        setFilters(stateToRestore.filters);
        setTextState(stateToRestore.textState);
        setCurrentImage(stateToRestore.image);
        setHistoryIndex(newIndex);
    };

    const handleFileUpload = async (file: File) => {
        setIsLoading(true);
        setError(null);
        try {
            const { dataUrl, mimeType } = await fileToDataUrl(file);
            const element = await loadImageElement(dataUrl);
            const imageState = { dataUrl, mimeType, element };
            const initialTextState = { ...INITIAL_TEXT, x: element.naturalWidth / 2, y: 100 };
            
            setOriginalImage(imageState);
            setCurrentImage(imageState);
            setFilters(INITIAL_FILTERS);
            setTextState(initialTextState);
            switchTool('adjust');

            const initialState = { filters: INITIAL_FILTERS, textState: initialTextState, image: imageState };
            setHistory([initialState]);
            setHistoryIndex(0);

        } catch (err) {
            setError("Failed to load image.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleFilterChange = (filter: keyof FilterState, value: string) => {
        setFilters(prev => ({ ...prev, [filter]: Number(value) }));
    };
    
    const handleApplyPresetFilter = (presetFilters: FilterState) => {
        if (!currentImage) return;
        setFilters(presetFilters);
        saveState({ filters: presetFilters, textState, image: currentImage });
    };

    const handleReset = () => {
        if (!originalImage) return;
        const newFilters = INITIAL_FILTERS;
        const newTextState = {...INITIAL_TEXT, x: originalImage.element.width / 2, y: 100};

        setFilters(newFilters);
        setTextState(newTextState);
        setCurrentImage(originalImage);
        saveState({ filters: newFilters, textState: newTextState, image: originalImage });
    };

    const handleDownload = () => {
        if (!currentImage) {
            alert("Per favore, carica un'immagine prima di scaricarla.");
            return;
        }
        const tempCanvas = document.createElement('canvas');
        drawCanvas(tempCanvas, currentImage, filters, textState);
        tempCanvas.toBlob((blob) => {
            if (blob) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                const extension = currentImage.mimeType.split('/')[1] || 'png';
                const filename = downloadFilename.trim() || 'edited-image';
                link.download = `${filename}.${extension}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            } else {
                setError("Impossibile creare il file immagine per il download.");
                console.error("Canvas toBlob ha restituito null.");
            }
        }, currentImage.mimeType, 1);
    };

    const handleEnhance = async () => {
        if (!currentImage) return;
        setIsLoading(true);
        setError(null);
        try {
            const optimalFilters = await getOptimalFilters(currentImage.dataUrl, currentImage.mimeType);
            const newFilters = { ...filters, ...optimalFilters };
            setFilters(newFilters);
            saveState({ filters: newFilters, textState, image: currentImage });
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleAiEdit = async () => {
        if (!currentImage || !aiPrompt) return;
        setIsLoading(true);
        setError(null);
        try {
            const editedImageBase64 = await editImageWithGemini(currentImage.dataUrl, currentImage.mimeType, aiPrompt);
            const element = await loadImageElement(editedImageBase64);
            const newImageState = { dataUrl: editedImageBase64, mimeType: 'image/png', element };
            setCurrentImage(newImageState);
            saveState({ filters, textState, image: newImageState });
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleGenerate = async () => {
        if (!generatePrompt) return;
        setIsLoading(true);
        setError(null);
        try {
            const generatedImageBase64 = await generateImageWithImagen(generatePrompt, aspectRatio);
            const element = await loadImageElement(generatedImageBase64);
            const newImageState = { dataUrl: generatedImageBase64, mimeType: 'image/jpeg', element };
            const newTextState = { ...INITIAL_TEXT, x: element.naturalWidth / 2, y: 100 };
            
            setOriginalImage(newImageState);
            setCurrentImage(newImageState);
            setFilters(INITIAL_FILTERS);
            setTextState(newTextState);
            switchTool('adjust');

            const initialState = { filters: INITIAL_FILTERS, textState: newTextState, image: newImageState };
            setHistory([initialState]);
            setHistoryIndex(0);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleApplyCrop = async () => {
        if (!currentImage || !cropState || !canvasRef.current) return;

        setIsLoading(true);
        setError(null);
        try {
            const tempCanvas = document.createElement('canvas');
            drawCanvas(tempCanvas, currentImage, filters, textState);

            const { x, y, width, height } = cropState;
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = width;
            finalCanvas.height = height;
            const finalCtx = finalCanvas.getContext('2d');

            if (!finalCtx) {
                throw new Error("Could not get context for cropping canvas.");
            }

            finalCtx.drawImage(tempCanvas, x, y, width, height, 0, 0, width, height);
            const croppedDataUrl = finalCanvas.toDataURL(currentImage.mimeType);

            const element = await loadImageElement(croppedDataUrl);
            const newImageState = { dataUrl: croppedDataUrl, mimeType: currentImage.mimeType, element };
            const newTextState = { ...INITIAL_TEXT, x: element.naturalWidth / 2, y: 100 };
            
            setOriginalImage(newImageState);
            setCurrentImage(newImageState);
            setFilters(INITIAL_FILTERS);
            setTextState(newTextState);
            
            const newState = { filters: INITIAL_FILTERS, textState: newTextState, image: newImageState };
            saveState(newState);
            switchTool('adjust');
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to apply crop.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const renderToolPanel = () => {
        switch (activeTool) {
            case 'adjust':
                return (
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Regolazioni</h3>
                        
                        {currentImage && (
                            <div className="mb-6">
                                <PresetFilters image={currentImage} onApply={handleApplyPresetFilter} />
                            </div>
                        )}

                        <div className="space-y-4" onMouseUp={commitChanges} onKeyUp={commitChanges}>
                            {(Object.keys(filters) as Array<keyof FilterState>).filter(key => key !== 'sepia').map(key => (
                                <div key={key}>
                                    <label htmlFor={key} className="block text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{key}</label>
                                    <input
                                        type="range"
                                        id={key}
                                        min={key === 'hue' ? "0" : "0"}
                                        max={key === 'hue' ? "360" : "200"}
                                        value={filters[key]}
                                        onChange={(e) => handleFilterChange(key, e.target.value)}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                                    />
                                    <span className="text-sm text-gray-500 dark:text-gray-400">{filters[key]}</span>
                                </div>
                            ))}
                            <button 
                                onClick={handleEnhance}
                                disabled={isLoading}
                                className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                            >
                                <MagicWandIcon className="w-5 h-5 mr-2" />
                                {isLoading ? 'Miglioramento...' : 'Migliora Immagine'}
                            </button>
                        </div>
                    </div>
                );
            case 'text':
                return (
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Testo</h3>
                         <div className="space-y-4">
                            <div>
                                <label htmlFor="textContent" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Contenuto</label>
                                <input type="text" value={textState.content} onChange={(e) => setTextState(p => ({...p, content: e.target.value}))} onBlur={commitChanges} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-light focus:border-brand-light sm:text-sm" />
                            </div>
                             <div>
                                <label htmlFor="textColor" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Colore</label>
                                <input type="color" value={textState.color} onChange={(e) => setTextState(p => ({...p, color: e.target.value}))} onBlur={commitChanges} className="mt-1 block w-full h-10 rounded-md" />
                            </div>
                            <div onMouseUp={commitChanges} onKeyUp={commitChanges}>
                                <label htmlFor="textSize" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Dimensione: {textState.size}px</label>
                                <input type="range" min="10" max="200" value={textState.size} onChange={(e) => setTextState(p => ({...p, size: Number(e.target.value)}))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700" />
                            </div>
                         </div>
                    </div>
                );
            case 'crop':
                return (
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Ritaglia</h3>
                        <button
                            onClick={handleApplyCrop}
                            disabled={isLoading || !cropState}
                            className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-light hover:bg-blue-600 disabled:bg-blue-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Applica Ritaglio
                        </button>
                    </div>
                );
            case 'ai-edit':
                 return (
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Modifica con IA</h3>
                        <div className="space-y-4">
                            <textarea
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                placeholder="Esempio: aggiungi un cappello da pirata al gatto"
                                className="w-full h-24 p-2 border rounded-md dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                            />
                            <button
                                onClick={handleAiEdit}
                                disabled={isLoading || !aiPrompt}
                                className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-light hover:bg-blue-600 disabled:bg-blue-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                <SparklesIcon className="w-5 h-5 mr-2" />
                                {isLoading ? 'Modifica...' : 'Applica Modifiche'}
                            </button>
                        </div>
                    </div>
                );
            case 'ai-generate':
                 return (
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Genera con IA</h3>
                        <div className="space-y-4">
                            <textarea
                                value={generatePrompt}
                                onChange={(e) => setGeneratePrompt(e.target.value)}
                                placeholder="Esempio: un gatto astronauta che cavalca un unicorno nello spazio, stile acquerello."
                                className="w-full h-24 p-2 border rounded-md dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                            />
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Proporzioni</label>
                                <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
                                    <option>1:1</option>
                                    <option>16:9</option>
                                    <option>9:16</option>
                                    <option>4:3</option>
                                    <option>3:4</option>
                                </select>
                            </div>
                            <button
                                onClick={handleGenerate}
                                disabled={isLoading || !generatePrompt}
                                className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-light hover:bg-blue-600 disabled:bg-blue-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                <SparklesIcon className="w-5 h-5 mr-2" />
                                {isLoading ? 'Generazione...' : 'Genera Immagine'}
                            </button>
                        </div>
                    </div>
                );
        }
    };
    
    const ToolButton: React.FC<{ tool: Tool, label: string, icon: React.ReactNode }> = ({ tool, label, icon }) => (
        <button
            onClick={() => switchTool(tool)}
            className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors duration-200 ${
                activeTool === tool
                    ? 'bg-brand-light text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            aria-label={label}
        >
            {icon}
            <span className="text-xs mt-1">{label}</span>
        </button>
    );

    return (
        <div className="min-h-screen flex flex-col text-gray-900 dark:text-gray-100">
            <header className="bg-white dark:bg-gray-800 shadow-md p-4 flex justify-between items-center">
                <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">Image Editor</h1>
                <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                    {isDarkMode ? <SunIcon /> : <MoonIcon />}
                </button>
            </header>

            <main className="flex-grow flex flex-col lg:flex-row p-4 gap-4">
                <div className="w-full lg:w-1/4 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-2 gap-4 mb-6">
                        <ToolButton tool="adjust" label="Regola" icon={<AdjustmentsIcon />} />
                        <ToolButton tool="text" label="Testo" icon={<TextIcon />} />
                        <ToolButton tool="crop" label="Ritaglia" icon={<CropIcon />} />
                        <ToolButton tool="ai-edit" label="Modifica IA" icon={<MagicWandIcon />} />
                        <ToolButton tool="ai-generate" label="Genera IA" icon={<SparklesIcon />} />
                    </div>
                    {renderToolPanel()}
                    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 flex flex-col space-y-3">
                        <div>
                            <label htmlFor="filename" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Nome del file
                            </label>
                            <input
                                type="text"
                                id="filename"
                                value={downloadFilename}
                                onChange={(e) => setDownloadFilename(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-light focus:border-brand-light sm:text-sm"
                                placeholder="edited-image"
                            />
                        </div>
                        <button onClick={handleDownload} disabled={!currentImage} className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-green-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                            <DownloadIcon className="w-5 h-5 mr-2" />
                            Scarica
                        </button>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={handleUndo} disabled={historyIndex <= 0} className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                                <UndoIcon className="w-5 h-5 mr-2" />
                                Annulla
                            </button>
                            <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                                <RedoIcon className="w-5 h-5 mr-2" />
                                Ripristina
                            </button>
                        </div>
                        <button onClick={handleReset} disabled={!currentImage} className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                            <ResetIcon className="w-5 h-5 mr-2" />
                            Reset
                        </button>
                        <label htmlFor="file-reupload" className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                            <UploadIcon className="w-5 h-5 mr-2"/>
                            {currentImage ? "Cambia Immagine" : "Carica Immagine"}
                        </label>
                        <input id="file-reupload" type="file" className="sr-only" accept="image/*" onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])} />
                    </div>
                </div>

                <div className="flex-grow flex items-center justify-center bg-gray-200 dark:bg-gray-800 rounded-lg shadow-inner p-4 min-h-[400px] lg:min-h-0">
                    {error && <div className="text-red-500 bg-red-100 dark:bg-red-900 p-4 rounded-md">{error}</div>}
                    {isLoading && !error && (
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-light dark:border-brand-dark mx-auto"></div>
                            <p className="mt-4">Elaborazione in corso...</p>
                        </div>
                    )}
                    {!isLoading && !currentImage && !error && <FileUploader onFileUpload={handleFileUpload} />}
                    {currentImage && (
                        <ImageCanvas 
                            canvasRef={canvasRef}
                            imageState={currentImage}
                            filters={filters}
                            textState={textState}
                            setTextState={setTextState}
                            onCommit={commitChanges}
                            activeTool={activeTool}
                            cropState={cropState}
                            setCropState={setCropState}
                        />
                    )}
                </div>
            </main>
        </div>
    );
};

export default App;