'use client';

import React, { useMemo } from 'react';
import SearchableCombobox from './SearchableCombobox';

type ComboboxItemType = {
    code: string;
    name: string;
};

type VerticalRulerProps = {
    label: string;
    min: number;
    max: number;
    value: number;
    onChange: (val: number) => void;
};

export function VerticalRuler2({
    label,
    min,
    max,
    value,
    onChange,
}: VerticalRulerProps) {

    // Generate items based on your type
    const numbers: ComboboxItemType[] = useMemo(() => {
        return Array.from({ length: max - min + 1 }, (_, i) => {
            const val = min + i;
            return {
                code: String(val),
                name: String(val),
            };
        });
    }, [min, max]);

    const selected = value ? String(value) : '';

    const handleChange = (val: string) => {
        onChange(Number(val));
    };

    return (
        <div>

            <span className="text-sm font-medium">{label}</span>
                <SearchableCombobox
                    items={numbers}
                    value={selected}
                    onValueChange={handleChange}
                    className="  w-30"
                />
        </div>
    );
}