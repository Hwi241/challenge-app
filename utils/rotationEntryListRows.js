export function rotationEntryCycleNumber(entry) {
  const number = Number(entry?.cycleNumber);
  return Number.isSafeInteger(number) && number > 0 ? number : 1;
}

export function buildRotationEntryListRows(entries, columns = 1) {
  const width = columns === 2 ? 2 : 1;
  const ordered = [...entries].sort((a, b) => {
    const cycleDifference = rotationEntryCycleNumber(b) - rotationEntryCycleNumber(a);
    if (cycleDifference) return cycleDifference;
    return (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0);
  });
  const rows = [];
  let currentCycle = null;
  let recordRow = null;
  ordered.forEach((entry, index) => {
    const cycleNumber = rotationEntryCycleNumber(entry);
    if (cycleNumber !== currentCycle) {
      currentCycle = cycleNumber;
      recordRow = null;
      rows.push({
        kind: 'cycle',
        key: 'rotation-cycle:' + cycleNumber,
        cycleNumber,
      });
    }
    if (!recordRow || recordRow.records.length >= width) {
      recordRow = {
        kind: 'records',
        key: 'rotation-records:' + cycleNumber + ':' + String(entry.id),
        records: [],
      };
      rows.push(recordRow);
    }
    recordRow.records.push({ entry, index });
  });
  return rows;
}
