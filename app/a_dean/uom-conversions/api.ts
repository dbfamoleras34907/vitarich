import { db } from '@/lib/Supabase/supabaseClient'
import { UomMaster } from '../uom-master/api'

export type UomConversionInput = {
  uom_id: number
  base_qty: number
  remarks?: string
}

export type UomGroupInput = {
  code: string
  name: string
  base_uom_id: number
  remarks?: string
  conversions: UomConversionInput[]
}

type UomReference = Pick<UomMaster, 'id' | 'code' | 'name'>
type ConversionRecord = {
  id: number
  base_qty: number
  remarks: string | null
  uom: UomReference | UomReference[] | null
}
type GroupRecord = {
  id: number
  code: string
  name: string
  remarks: string | null
  created_at: string
  base_uom: UomReference | UomReference[] | null
  conversions: ConversionRecord[] | null
}

export type UomConversionRow = {
  id: string
  group_id: number
  group_code: string
  group_name: string
  base_uom: string
  uom_code: string
  uom_name: string
  base_qty: number
  meaning: string
  remarks: string
}

const singleRelation = <T,>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? value[0] || null : value

const formatQuantity = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(value)

export async function getUomConversionRows(): Promise<UomConversionRow[]> {
  const { data, error } = await db
    .from('uom_groups')
    .select(`
      id, code, name, remarks, created_at,
      base_uom:uom_master_data!uom_groups_base_uom_id_fkey(id, code, name),
      conversions:uom_group_conversions!uom_group_conversions_uom_group_id_fkey(
        id, base_qty, remarks,
        uom:uom_master_data!uom_group_conversions_uom_id_fkey(id, code, name)
      )
    `)
    .eq('void', '1')
    .eq('conversions.void', '1')
    .order('code', { ascending: true })

  if (error) throw error

  return ((data || []) as unknown as GroupRecord[]).flatMap(group => {
    const baseUom = singleRelation(group.base_uom)
    return (group.conversions || []).flatMap(conversion => {
      const uom = singleRelation(conversion.uom)
      if (!uom || !baseUom) return []

      const quantity = Number(conversion.base_qty)
      return [{
        id: `${group.id}-${conversion.id}`,
        group_id: group.id,
        group_code: group.code,
        group_name: group.name,
        base_uom: `${baseUom.code} - ${baseUom.name}`,
        uom_code: uom.code,
        uom_name: uom.name,
        base_qty: quantity,
        meaning: uom.id === baseUom.id
          ? 'Base Unit'
          : `1 ${uom.code} = ${formatQuantity(quantity)} ${baseUom.code}`,
        remarks: conversion.remarks || group.remarks || '',
      }]
    })
  })
}

export async function addUomGroup(payload: UomGroupInput) {
  const { data: authData } = await db.auth.getUser()
  const userId = authData.user?.id || null
  const { data: group, error: groupError } = await db
    .from('uom_groups')
    .insert({
      code: payload.code.trim().toUpperCase(),
      name: payload.name.trim(),
      base_uom_id: payload.base_uom_id,
      remarks: payload.remarks?.trim() || null,
      created_by: userId,
      void: '1',
    })
    .select()
    .single()

  if (groupError) throw groupError

  const { error: conversionError } = await db
    .from('uom_group_conversions')
    .insert(payload.conversions.map(conversion => ({
      uom_group_id: group.id,
      uom_id: conversion.uom_id,
      base_qty: conversion.base_qty,
      remarks: conversion.remarks?.trim() || null,
      created_by: userId,
      void: '1',
    })))

  if (conversionError) {
    await db.from('uom_groups').delete().eq('id', group.id)
    throw conversionError
  }

  return group
}

export async function getUomGroupById(id: number) {
  const { data, error } = await db
    .from('uom_groups')
    .select(`
      id, code, name, base_uom_id, remarks,
      conversions:uom_group_conversions!uom_group_conversions_uom_group_id_fkey(
        id, uom_id, base_qty, remarks, void
      )
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function updateUomGroup(id: number, payload: UomGroupInput) {
  const { data: authData } = await db.auth.getUser()
  const userId = authData.user?.id || null
  const updatedAt = new Date().toISOString()

  const { error: groupError } = await db
    .from('uom_groups')
    .update({
      code: payload.code.trim().toUpperCase(),
      name: payload.name.trim(),
      base_uom_id: payload.base_uom_id,
      remarks: payload.remarks?.trim() || null,
      updated_by: userId,
      updated_at: updatedAt,
    })
    .eq('id', id)

  if (groupError) throw groupError

  const { error: voidRowsError } = await db
    .from('uom_group_conversions')
    .update({ void: '0', updated_by: userId, updated_at: updatedAt })
    .eq('uom_group_id', id)
    .eq('void', '1')

  if (voidRowsError) throw voidRowsError

  const { error: insertError } = await db
    .from('uom_group_conversions')
    .upsert(
      payload.conversions.map(conversion => ({
        uom_group_id: id,
        uom_id: conversion.uom_id,
        base_qty: conversion.base_qty,
        remarks: conversion.remarks?.trim() || null,
        created_by: userId,
        updated_by: userId,
        updated_at: updatedAt,
        void: '1',
      })),
      { onConflict: 'uom_group_id,uom_id' }
    )

  if (insertError) throw insertError
}

export async function voidUomGroup(id: number) {
  const { data: authData } = await db.auth.getUser()
  const userId = authData.user?.id || null
  const updatedAt = new Date().toISOString()

  const { error: rowsError } = await db
    .from('uom_group_conversions')
    .update({ void: '0', updated_by: userId, updated_at: updatedAt })
    .eq('uom_group_id', id)

  if (rowsError) throw rowsError

  const { error: groupError } = await db
    .from('uom_groups')
    .update({ void: '0', updated_by: userId, updated_at: updatedAt })
    .eq('id', id)

  if (groupError) throw groupError
}
