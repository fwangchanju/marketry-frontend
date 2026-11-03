import type { HeatmapSectorNode } from '@/types/api'

export function excludedNamesForPaths(nodes: HeatmapSectorNode[], excludedPaths: string[]): Map<number, string> {
  const selected = new Set(excludedPaths)
  const result = new Map<number, string>()
  const visit = (items: HeatmapSectorNode[], ancestors: string[] = []) => {
    for (const node of items) {
      const pathParts = [...ancestors, node.sectorName]
      const path = pathParts.join(' > ')
      if (selected.has(path)) result.set(node.sectorId, path)
      visit(node.children, pathParts)
    }
  }
  visit(nodes)
  return result
}
