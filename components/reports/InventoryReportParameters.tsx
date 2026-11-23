'use client'

import SearchableCombobox from '@/components/SearchableCombobox'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ChevronDown, Loader2 } from 'lucide-react'
import React, { useMemo, useState } from 'react'

type ReportFarm = { id: number; code: string; name: string }
type ReportWarehouse = { id: number; code: string; name: string; type: string; farmCode: string }

type Props = {
  farms: ReportFarm[]
  selectedFarmCode: string
  onFarmChange: (value: string) => void
  loadingFarms: boolean
  selectedFarm: ReportFarm | undefined
  warehouses: ReportWarehouse[]
  selectedCodes: string[]
  onSelectedCodesChange: (value: string[]) => void
  loadingWarehouses: boolean
  from: string
  onFromChange: (value: string) => void
  to: string
  onToChange: (value: string) => void
  loading: boolean
  onGenerate: () => void
  children?: React.ReactNode
}

export default function InventoryReportParameters({
  farms,
  selectedFarmCode,
  onFarmChange,
  loadingFarms,
  selectedFarm,
  warehouses,
  selectedCodes,
  onSelectedCodesChange,
  loadingWarehouses,
  from,
  onFromChange,
  to,
  onToChange,
  loading,
  onGenerate,
  children,
}: Props) {
  const [warehouseSearch, setWarehouseSearch] = useState('')
  const selectedLabel = selectedCodes.length === 0
    ? 'Select warehouses'
    : selectedCodes.length === 1
      ? selectedCodes[0]
      : `${selectedCodes.length} warehouses selected`
  const filteredWarehouses = useMemo(() => {
    const search = warehouseSearch.trim().toLowerCase()
    if (!search) return warehouses
    return warehouses.filter(warehouse =>
      [warehouse.code, warehouse.name, warehouse.type, warehouse.farmCode]
        .some(value => value.toLowerCase().includes(search)),
    )
  }, [warehouseSearch, warehouses])
  const allFilteredSelected = filteredWarehouses.length > 0
    && filteredWarehouses.every(warehouse => selectedCodes.includes(warehouse.code))

  return (
    <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-2 lg:grid-cols-[minmax(200px,1fr)_minmax(250px,1.4fr)_minmax(140px,.8fr)_minmax(140px,.8fr)_auto_auto]">
      <SearchableCombobox
        label="Farm"
        required
        showCode
        items={farms}
        value={selectedFarmCode}
        onValueChange={value => {
          setWarehouseSearch('')
          onFarmChange(value)
        }}
        placeholder={loadingFarms ? 'Loading farms...' : 'Select farm...'}
        disabled={loadingFarms}
        className="w-full"
      />

      <label className="space-y-1">
        <span className="text-sm font-medium">Warehouses / Buildings</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between font-normal"
              disabled={!selectedFarm || loadingWarehouses}
            >
              {loadingWarehouses ? 'Loading warehouses...' : selectedFarm ? selectedLabel : 'Select farm first'}
              <ChevronDown className="size-4 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-80 w-[min(360px,calc(100vw-24px))] overflow-y-auto" align="start">
            <div className="sticky top-0 z-10 bg-popover p-2">
              <Input
                autoFocus
                placeholder="Search code, name, or type..."
                value={warehouseSearch}
                onChange={event => setWarehouseSearch(event.target.value)}
                onKeyDown={event => event.stopPropagation()}
              />
            </div>
            <DropdownMenuLabel className="flex items-center justify-between">
              Select warehouses
              <button
                type="button"
                className="text-xs font-normal text-primary"
                onClick={() => {
                  const filteredCodes = new Set(filteredWarehouses.map(row => row.code))
                  onSelectedCodesChange(allFilteredSelected
                    ? selectedCodes.filter(code => !filteredCodes.has(code))
                    : Array.from(new Set([...selectedCodes, ...filteredCodes])))
                }}
              >
                {allFilteredSelected ? 'Clear visible' : 'Select visible'}
              </button>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {filteredWarehouses.map(warehouse => (
              <DropdownMenuCheckboxItem
                key={warehouse.id}
                checked={selectedCodes.includes(warehouse.code)}
                onCheckedChange={checked => onSelectedCodesChange(checked === true
                  ? Array.from(new Set([...selectedCodes, warehouse.code]))
                  : selectedCodes.filter(value => value !== warehouse.code))}
                onSelect={event => event.preventDefault()}
              >
                <span className="min-w-0">
                  <span className="font-medium">{warehouse.code}</span>
                  <span className="ml-2 text-muted-foreground">{warehouse.name || 'Unnamed'}</span>
                  {(warehouse.type || warehouse.farmCode) && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({[warehouse.type, warehouse.farmCode].filter(Boolean).join(' • ')})
                    </span>
                  )}
                </span>
              </DropdownMenuCheckboxItem>
            ))}
            {filteredWarehouses.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">No matching warehouses</div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </label>

      <label className="space-y-1">
        <span className="text-sm font-medium">From Date</span>
        <Input type="date" value={from} onChange={event => onFromChange(event.target.value)} />
      </label>
      <label className="space-y-1">
        <span className="text-sm font-medium">To Date</span>
        <Input type="date" value={to} onChange={event => onToChange(event.target.value)} />
      </label>
      {children}
      <Button onClick={onGenerate} disabled={loading}>
        {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
        Generate
      </Button>
    </div>
  )
}
