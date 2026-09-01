'use client'

import { Label } from '@/components/ui/label'
import SearchableDropdown from '@/lib/SearchableDropdown'
import {
  getItemGroupChildren,
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
  let parentId = rootGroupId

  for (const levelIndex of Array.from({ length: ITEM_GROUP_MAX_SUBGROUP_LEVELS }, (_, index) => index)) {
    const children = getItemGroupChildren(groups, parentId)
    if (children.length === 0) break

    const selectedId = selectedIds[levelIndex] ?? ''
    const selectedGroup = children.find(group => String(group.id) === selectedId)
    const selectedHasChildren = selectedGroup?.id != null &&
      getItemGroupChildren(groups, Number(selectedGroup.id)).length > 0
    const options: CascadeOption[] = [
      { id: '', label: levelIndex === 0 ? 'No sub item group' : 'Clear this level' },
      ...children.map(group => ({
        id: String(group.id),
        label: `${group.code} - ${group.name}`,
      })),
    ]

    fields.push(
      <div key={levelIndex} className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label>Sub Group Level {levelIndex + 1}</Label>
          <span className="text-xs text-stone-400">
            {selectedGroup ? (selectedHasChildren ? `Continue to Level ${levelIndex + 2}` : 'Leaf group') : 'Optional'}
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

    if (!selectedGroup?.id) break
    parentId = Number(selectedGroup.id)
  }

  return <div className="contents">{fields}</div>
}
