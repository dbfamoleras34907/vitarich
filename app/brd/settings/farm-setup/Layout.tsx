'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Check, Circle, Loader2, Play } from 'lucide-react'
import { toast } from 'sonner'

import DocReceivingSettingsLayout from '@/app/a_dean/doc-receiving-settings/Layout'
import { getFarmById } from '@/app/a_dean/farm/api'
import BrCleanupSettingsLayout from '@/app/brd/cu/settings/Layout'
import FlockCardSettingsLayout from '@/app/brd/fc/settings/Layout'
import BrDeliverySettingsLayout from '@/app/brd/dr/settings/Layout'
import { Button } from '@/components/ui/button'
import UserFarmSearchCombobox, { type UserFarm } from '@/components/ui/UserFarmSearchCombobox'
import Breadcrumb from '@/lib/Breadcrumb'

const PERMISSION_BASE_PATH = '/brd/settings/farm-setup'

const STEPS = [
  'DOC Placement Settings',
  'Growing & Farm Condition Settings',
  'Harvest & Delivery Settings',
  'Clean up Settings',
] as const

function isBroilerFarm(farm: UserFarm) {
  const farmType = String(farm.farm_type ?? '').trim().toUpperCase()
  return farmType === 'BR' || farmType === 'BROILER'
}

export default function BroilerFarmSetupLayout() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedFarmId = Number(searchParams.get('farmId'))
  const [farm, setFarm] = useState<UserFarm | null>(null)
  const [selectedFarmId, setSelectedFarmId] = useState('')
  const [step, setStep] = useState(0)
  const [started, setStarted] = useState(false)
  const [loadingFarm, setLoadingFarm] = useState(Number.isFinite(requestedFarmId) && requestedFarmId > 0)

  useEffect(() => {
    if (!Number.isFinite(requestedFarmId) || requestedFarmId <= 0) return

    let cancelled = false
    getFarmById(requestedFarmId)
      .then((record) => {
        if (cancelled) return
        const nextFarm = record as UserFarm
        if (!isBroilerFarm(nextFarm)) {
          toast.error('Broiler Farm Setup is available only for Broiler farms.')
          return
        }
        setFarm(nextFarm)
        setSelectedFarmId(String(nextFarm.id))
        setStarted(true)
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Unable to load the selected farm.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingFarm(false)
      })

    return () => {
      cancelled = true
    }
  }, [requestedFarmId])

  const farmLabel = useMemo(() => {
    if (!farm) return ''
    return farm.code ? `${farm.code} - ${farm.name}` : farm.name
  }, [farm])

  const startSetup = () => {
    if (!farm || !selectedFarmId) {
      toast.error('Select a Broiler farm first.')
      return
    }
    setStep(0)
    setStarted(true)
  }

  const handleBack = () => {
    if (step > 0) {
      setStep((current) => current - 1)
      return
    }
    setStarted(false)
  }

  const handleSaved = () => {
    if (step < STEPS.length - 1) {
      setStep((current) => current + 1)
      return
    }
    toast.success('Broiler Farm Setup completed.')
    router.push('/a_dean/farm')
  }

  const sharedProps = {
    fixedFarmId: Number(selectedFarmId),
    fixedFarm: farm,
    embedded: true,
    permissionBasePath: PERMISSION_BASE_PATH,
    usePreviousFarmDefaults: true,
    saveLabel: step === STEPS.length - 1 ? 'Save & Finish' : 'Save & Continue',
    onSaved: handleSaved,
  }

  return (
    <main className="mx-auto max-w-7xl space-y-3 p-3 sm:p-4">
      <Breadcrumb FirstPreviewsPageName="Settings" CurrentPageName="Broiler Farm Setup" />

      {!started ? (
        <section className="mx-auto max-w-3xl rounded-lg border bg-card p-5 shadow-sm sm:p-6">
          <h1 className="text-xl font-semibold tracking-tight">Broiler Farm Setup</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select an existing Broiler farm, then complete its four operational settings modules.
          </p>

          <div className="mt-6 space-y-4">
            <UserFarmSearchCombobox
              label="Broiler Farm"
              required
              farmType="BR"
              value={selectedFarmId}
              onValueChange={(farmId, selectedFarm) => {
                setSelectedFarmId(farmId)
                setFarm(selectedFarm ?? null)
              }}
            />
            <div className="flex justify-end">
              <Button type="button" onClick={startSetup} disabled={!selectedFarmId || !farm || loadingFarm}>
                {loadingFarm ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                Start Setup
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <div className="grid overflow-hidden rounded-lg border bg-card shadow-sm md:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="border-b bg-muted/40 p-5 md:border-r md:border-b-0">
            <div className="text-sm font-semibold">Broiler Farm Setup</div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">{farmLabel}</div>

            <nav className="mt-6 grid gap-5">
              {STEPS.map((title, index) => {
                const complete = step > index
                const active = step === index
                return (
                  <div key={title} className="flex items-start gap-3">
                    <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${
                      complete
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : active
                          ? 'border-emerald-600 text-emerald-700'
                          : 'border-border text-muted-foreground'
                    }`}>
                      {complete ? <Check className="size-3" /> : <Circle className="size-2 fill-current" />}
                    </span>
                    <span className={active ? 'text-sm font-medium' : 'text-sm text-muted-foreground'}>{title}</span>
                  </div>
                )
              })}
            </nav>

            <Button type="button" variant="outline" className="mt-8 w-full" onClick={handleBack}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
          </aside>

          <section className="min-w-0 p-3 sm:p-4">
            {step === 0 ? <DocReceivingSettingsLayout {...sharedProps} /> : null}
            {step === 1 ? <FlockCardSettingsLayout {...sharedProps} /> : null}
            {step === 2 ? <BrDeliverySettingsLayout {...sharedProps} /> : null}
            {step === 3 ? <BrCleanupSettingsLayout {...sharedProps} /> : null}
          </section>
        </div>
      )}
    </main>
  )
}
