import React from 'react';
import { ImageState, FilterState } from '../types';

interface Preset {
  name: string;
  filters: Partial<FilterState>;
}

const PRESETS: Preset[] = [
    { name: 'Nessuno', filters: { brightness: 100, contrast: 100, saturate: 100, hue: 0, sepia: 0 } },
    { name: 'B/N', filters: { saturate: 0, contrast: 110 } },
    { name: 'Seppia', filters: { sepia: 100, contrast: 90, brightness: 110 } },
    { name: 'Vintage', filters: { brightness: 110, contrast: 90, saturate: 120, sepia: 25 } },
    { name: 'Freddo', filters: { brightness: 105, saturate: 90, contrast: 105 } },
    { name: 'Caldo', filters: { brightness: 105, contrast: 110, saturate: 110, hue: -10, sepia: 10 } },
    { name: 'Luminoso', filters: { brightness: 120, contrast: 110, saturate: 110 } },
];

const filterStateToCss = (filters: Partial<FilterState>): string => {
    const defaults = { brightness: 100, contrast: 100, saturate: 100, hue: 0, sepia: 0 };
    const f = { ...defaults, ...filters };
    return `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%) hue-rotate(${f.hue}deg) sepia(${f.sepia}%)`;
};

interface PresetFiltersProps {
    image: ImageState;
    onApply: (filters: FilterState) => void;
}

const PresetFilters: React.FC<PresetFiltersProps> = ({ image, onApply }) => {
    const handlePresetClick = (presetFilters: Partial<FilterState>) => {
        const fullFilters: FilterState = {
            brightness: 100,
            contrast: 100,
            saturate: 100,
            hue: 0,
            sepia: 0,
            ...presetFilters
        };
        onApply(fullFilters);
    };

    return (
        <div>
            <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-3">Filtri predefiniti</h4>
            <div className="grid grid-cols-4 gap-3">
                {PRESETS.map(preset => (
                    <button
                        key={preset.name}
                        onClick={() => handlePresetClick(preset.filters)}
                        className="text-center group focus:outline-none"
                        aria-label={`Applica filtro ${preset.name}`}
                    >
                        <div
                            className="w-full h-16 bg-cover bg-center rounded-md border-2 border-transparent group-hover:border-brand-light dark:group-hover:border-brand-dark group-focus:ring-2 group-focus:ring-offset-2 dark:ring-offset-gray-800 group-focus:ring-brand-light transition-all duration-200"
                            style={{
                                backgroundImage: `url(${image.dataUrl})`,
                                filter: filterStateToCss(preset.filters),
                            }}
                        ></div>
                        <span className="text-xs mt-1 block text-gray-600 dark:text-gray-300 group-hover:text-brand-light dark:group-hover:text-brand-dark">{preset.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default PresetFilters;
