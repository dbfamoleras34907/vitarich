"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TempUnit = "C" | "F";

type TemperatureConverterProps = {
  title?: string;
  defaultFromUnit?: TempUnit;
  defaultValue?: number;
  className?: string;

  /**
   * Fires whenever conversion changes
   */
  onChange?: (payload: {
    inputValue: number;
    inputUnit: TempUnit;
    outputValue: number;
    outputUnit: TempUnit;
    formula: string;
  }) => void;

  /**
   * Optional button to apply converted value to parent form field
   */
  onApply?: (value: number, unit: TempUnit) => void;

  /**
   * Optional control for parent to hide apply button
   */
  showApplyButton?: boolean;
};

function roundTemp(value: number) {
  return Number(value.toFixed(2));
}

function convertTemperature(value: number, from: TempUnit, to: TempUnit) {
  if (from === to) return value;

  if (from === "C" && to === "F") {
    return (value * 9) / 5 + 32;
  }

  return ((value - 32) * 5) / 9;
}

function getOppositeUnit(unit: TempUnit): TempUnit {
  return unit === "C" ? "F" : "C";
}

function getFormulaText(
  from: TempUnit,
  to: TempUnit,
  value: number,
  result: number,
) {
  if (from === "C" && to === "F") {
    return `(${value}°C × 9/5) + 32 = ${result}°F`;
  }

  if (from === "F" && to === "C") {
    return `(${value}°F - 32) × 5/9 = ${result}°C`;
  }

  return `${value}°${from} = ${result}°${to}`;
}

export default function TemperatureConverter({
  title = "Temperature",
  defaultFromUnit = "C",
  defaultValue = 0,
  className = "",
  onChange,
  onApply,
  showApplyButton = false,
}: TemperatureConverterProps) {
  const [fromUnit, setFromUnit] = useState<TempUnit>(defaultFromUnit);
  const [toUnit, setToUnit] = useState<TempUnit>(
    getOppositeUnit(defaultFromUnit),
  );
  const [fromValue, setFromValue] = useState<string>(String(defaultValue));

  const numericInput = useMemo(() => {
    const n = Number(fromValue);
    return Number.isNaN(n) ? 0 : n;
  }, [fromValue]);

  const convertedValue = useMemo(() => {
    return roundTemp(convertTemperature(numericInput, fromUnit, toUnit));
  }, [numericInput, fromUnit, toUnit]);

  const formulaText = useMemo(() => {
    return getFormulaText(fromUnit, toUnit, numericInput, convertedValue);
  }, [fromUnit, toUnit, numericInput, convertedValue]);

  useEffect(() => {
    onChange?.({
      inputValue: numericInput,
      inputUnit: fromUnit,
      outputValue: convertedValue,
      outputUnit: toUnit,
      formula: formulaText,
    });
  }, [numericInput, fromUnit, convertedValue, toUnit, formulaText, onChange]);

  function handleFromUnitChange(value: string) {
    const nextFrom = value as TempUnit;
    setFromUnit(nextFrom);
    setToUnit(getOppositeUnit(nextFrom));
  }

  function handleToUnitChange(value: string) {
    const nextTo = value as TempUnit;
    setToUnit(nextTo);
    setFromUnit(getOppositeUnit(nextTo));
  }

  function handleSwap() {
    const oldFromUnit = fromUnit;
    const oldToUnit = toUnit;
    const oldConvertedValue = convertedValue;

    setFromUnit(oldToUnit);
    setToUnit(oldFromUnit);
    setFromValue(String(oldConvertedValue));
  }

  function handleApply() {
    onApply?.(convertedValue, toUnit);
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-2">
        <Label>{`${title} Converter`}</Label>
        {/* <Select value="temperature" disabled>
          <SelectTrigger>
            <SelectValue placeholder="Temperature" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="temperature">Temperature</SelectItem>
          </SelectContent>
        </Select> */}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <div className="space-y-2 min-w-0">
          <Input
            type="number"
            step="0.01"
            value={fromValue}
            onChange={(e) => setFromValue(e.target.value)}
            className="h-16 w-full text-center text-[36px]! font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <Select value={fromUnit} onValueChange={handleFromUnitChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="C">Degree Celsius</SelectItem>
              <SelectItem value="F">Fahrenheit</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-center text-4xl font-bold md:pt-1">=</div>

        <div className="space-y-2 min-w-0">
          <Input
            type="number"
            step="0.01"
            value={convertedValue}
            readOnly
            className="h-16 w-full bg-muted text-center text-[36px]! font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <Select value={toUnit} onValueChange={handleToUnitChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="F">Fahrenheit</SelectItem>
              <SelectItem value="C">Degree Celsius</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Button type="button" variant="outline" onClick={handleSwap}>
          Swap
        </Button>
        {showApplyButton ? (
          <Button type="button" onClick={handleApply}>
            Apply Result
          </Button>
        ) : null}

        <div className="text-sm wrap-break-words">
          <span className="rounded bg-yellow-200 px-2 py-0.5 font-medium">
            Formula
          </span>{" "}
          {formulaText}
        </div>
      </div>
    </div>
  );
}
