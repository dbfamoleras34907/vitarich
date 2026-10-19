type FarmDisplayValue = string | number | null | undefined;

function displayPart(value: FarmDisplayValue, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

/** Formats farm choices consistently without changing the selected farm ID. */
export function formatFarmNameCodeId(
  farmName: FarmDisplayValue,
  farmCode: FarmDisplayValue,
  farmId: FarmDisplayValue,
) {
  return `${formatFarmNameCode(farmName, farmCode)} - ${displayPart(farmId)}`;
}

export function formatFarmNameCode(
  farmName: FarmDisplayValue,
  farmCode: FarmDisplayValue,
) {
  return `${displayPart(farmName)} - ${displayPart(farmCode)}`;
}
