import type { BreederCleanupCycle } from "../repositories/breederCleanup";

export type CullingBuilding = {
  key: string;
  farm_id: number;
  building_id: number;
  building_name: string;
  cycle_no: number;
  cycle_id: number;
  cycle_ids: number[];
  placement_date: string | null;
  female_system_balance: number;
  male_system_balance: number;
};

export function groupCullingBuildings(cycles: BreederCleanupCycle[]): CullingBuilding[] {
  const groups = new Map<string, CullingBuilding>();
  for (const cycle of cycles) {
    const key = `${cycle.farm_id}:${cycle.building_id}:${cycle.cycle_no}`;
    const row = groups.get(key) ?? {
      key, farm_id: cycle.farm_id, building_id: cycle.building_id, building_name: cycle.building_name,
      cycle_no: cycle.cycle_no, cycle_id: cycle.id, cycle_ids: [], placement_date: null,
      female_system_balance: 0, male_system_balance: 0,
    };
    if (row.cycle_ids.includes(cycle.id)) continue;
    row.cycle_ids.push(cycle.id);
    row.cycle_id = Math.min(row.cycle_id, cycle.id);
    row.female_system_balance += cycle.female_system_balance;
    row.male_system_balance += cycle.male_system_balance;
    if (cycle.placement_date && (!row.placement_date || cycle.placement_date < row.placement_date)) row.placement_date = cycle.placement_date;
    groups.set(key, row);
  }
  return [...groups.values()].map(row => ({ ...row, cycle_ids: row.cycle_ids.sort((a, b) => a - b) }))
    .sort((a, b) => a.building_name.localeCompare(b.building_name, undefined, { numeric: true }) || b.cycle_no - a.cycle_no);
}
