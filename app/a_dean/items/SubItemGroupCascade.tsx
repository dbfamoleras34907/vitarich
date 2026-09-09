'use client'

import { Label } from '@/components/ui/label'
import SearchableDropdown from '@/lib/SearchableDropdown'
import {
  ITEM_GROUP_MAX_SUBGROUP_LEVELS,
  type ItemGroup,
} from '../itemgroups/api'

type CascadeOption = {
  id: string
  label: string
}

type SubItemGroupCascadeProps = {
  groups: ItemGroup[]
  rootGroupId?: number | null
  selectedIds: string[]
  onChange: (selectedIds: string[]) => void
}

export default function SubItemGroupCascade({
  groups,
  rootGroupId,
  selectedIds,
  onChange,
}: SubItemGroupCascadeProps) {
  if (!rootGroupId) return null

  const fields: React.ReactNode[] = []

  for (const levelIndex of Array.from({ length: ITEM_GROUP_MAX_SUBGROUP_LEVELS }, (_, index) => index)) {
    if (levelIndex > 0 && !selectedIds[levelIndex - 1]) break
    const level = levelIndex + 1
    const levelGroups = groups.filter(group =>
      Number(group.root_item_group_id) === rootGroupId && Number(group.subgroup_level) === level,
    )
    if (levelGroups.length === 0) break

    const selectedId = selectedIds[levelIndex] ?? ''
    const selectedGroup = levelGroups.find(group => String(group.id) === selectedId)
    const nextLevelAvailable = groups.some(group =>
      Number(group.root_item_group_id) === rootGroupId && Number(group.subgroup_level) === level + 1,
    )
    const options: CascadeOption[] = [
      { id: '', label: levelIndex === 0 ? 'No sub item group' : 'Clear this level' },
      ...levelGroups.map(group => ({
        id: String(group.id),
        label: `${group.code} - ${group.name}`,
      })),
    ]

    fields.push(
      <div key={levelIndex} className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label>Sub Group Level {levelIndex + 1}</Label>
          <span className="text-xs text-stone-400">
            {selectedGroup ? (nextLevelAvailable ? `Optional: continue to Level ${levelIndex + 2}` : 'Selected') : 'Optional'}
          </span>
        </div>
        <SearchableDropdown
          codeLabel="id"
          nameLabel="label"
          list={options}
          value={selectedId}
          placeholder={`Select Sub Group Level ${levelIndex + 1}`}
          showNameOnly
          onChange={value => {
            const nextSelectedIds = value
              ? [...selectedIds.slice(0, levelIndex), value]
              : selectedIds.slice(0, levelIndex)
            onChange(nextSelectedIds)
          }}
        />
      </div>,
    )
  }

  return <div className="contents">{fields}</div>
}
