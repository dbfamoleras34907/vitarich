// app/jmb/hatcheryclassi/view/[id]/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Loader2, ArrowLeft } from 'lucide-react'
import { getHatchClassificationById } from '../../updatefd/api'
import { HatchClassificationRow } from '../../new/api'

 
export default function Layout() {
  const params = useParams()
  const router = useRouter()

  const id = Number(params.id)

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<HatchClassificationRow | null>(null)

  useEffect(() => {
    if (!id) return

    loadData()
  }, [id])

  async function loadData() {
    try {
      setLoading(true)

      const res = await getHatchClassificationById(id)
      setData(res)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const totalClassify = useMemo(() => {
    if (!data) return 0

    return (
      Number(data.good_egg || 0) +
      Number(data.trans_crack || 0) +
      Number(data.hatc_crack || 0) +
      Number(data.trans_condemn || 0) +
      Number(data.hatc_condemn || 0) +
      Number(data.thin_shell || 0) +
      Number(data.pee_wee || 0) +
      Number(data.small || 0) +
      Number(data.jumbo || 0) +
      Number(data.d_yolk || 0) +
      Number(data.misshapen || 0) +
      Number(data.leakers || 0) +
      Number(data.dirties || 0) +
      Number(data.hairline || 0)
    )
  }, [data])

  const discrepancy = useMemo(() => {
    return Number(data?.ttl_count || 0) - totalClassify
  }, [data, totalClassify])

  const eggRecovery = useMemo(() => {
    const total = Number(data?.ttl_count || 0)
    const goodEgg = Number(data?.good_egg || 0)

    if (!total) return 0

    return ((goodEgg / total) * 100).toFixed(2)
  }, [data])

  function ReadOnlyField({
    label,
    value,
  }: {
    label: string
    value: string | number | null | undefined
  }) {
    return (
      <div className="space-y-1">
        <Label>{label}</Label>

        <Input
          value={value ?? ''}
          readOnly
          className="bg-muted"
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6">
        <p>Record not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Hatchery Classification View
          </h1>

          <p className="text-sm text-muted-foreground">
            View hatch classification details
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => router.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Top Card */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <ReadOnlyField
              label="Breeder Ref. No."
              value={data.br_no}
            />

            <ReadOnlyField
              label="Classification Ref. No."
              value={data.classi_ref_no}
            />

            <ReadOnlyField
              label="Classification Date"
              value={data.date_classify}
            />

            <ReadOnlyField
              label="Farm Code"
              value={data.farm_code}
            />
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <ReadOnlyField
              label="Total Count"
              value={data.ttl_count}
            />

            <ReadOnlyField
              label="Good Egg"
              value={data.good_egg}
            />

            <ReadOnlyField
              label="Transport Crack"
              value={data.trans_crack}
            />

            <ReadOnlyField
              label="Transport Condemn"
              value={data.trans_condemn}
            />
          </div>
        </CardContent>
      </Card>

      {/* Classification Details */}
      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <ReadOnlyField
              label="Hatch Crack"
              value={data.hatc_crack}
            />

            <ReadOnlyField
              label="Thin Shell"
              value={data.thin_shell}
            />

            <ReadOnlyField
              label="Hatch Condemn"
              value={data.hatc_condemn}
            />

            <ReadOnlyField
              label="Small"
              value={data.small}
            />

            <ReadOnlyField
              label="Pee Wee"
              value={data.pee_wee}
            />

            <ReadOnlyField
              label="Double Yolk"
              value={data.d_yolk}
            />

            <ReadOnlyField
              label="Jumbo"
              value={data.jumbo}
            />

            <ReadOnlyField
              label="Misshapen"
              value={data.misshapen}
            />

            <ReadOnlyField
              label="Leakers"
              value={data.leakers}
            />

            <ReadOnlyField
              label="Dirties"
              value={data.dirties}
            />

            <ReadOnlyField
              label="Hairline"
              value={data.hairline}
            />

            <ReadOnlyField
              label="Is Active"
              value={data.is_active ? 'Yes' : 'No'}
            />
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <ReadOnlyField
              label="Total Classify"
              value={totalClassify}
            />

            <ReadOnlyField
              label="Discrepancy"
              value={discrepancy}
            />

            <ReadOnlyField
              label="Percentage Egg Recovery"
              value={`${eggRecovery}%`}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}