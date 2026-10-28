export type MobileRankEntry = { key: string; value: number; reference?: boolean; hiddenCount?: number }

// 기준 지수는 생략하지 않고, 업종 수가 많으면 양쪽 끝만 남긴다.
export function mobileGraphRank<T extends MobileRankEntry>(entries: T[], edge = 7): (T | MobileRankEntry)[] {
  const sorted = [...entries].sort((a, b) => b.value - a.value)
  const sectors = sorted.filter(item => !item.reference)
  if (sectors.length <= edge * 2) return sorted
  const top = sectors.slice(0, edge)
  const bottom = sectors.slice(-edge)
  const visible = sorted.filter(item => item.reference || top.includes(item) || bottom.includes(item))
  const split = visible.indexOf(top[top.length - 1]) + 1
  return [...visible.slice(0, split), { key: 'hidden-sectors', value: 0, hiddenCount: sectors.length - edge * 2 }, ...visible.slice(split)]
}
