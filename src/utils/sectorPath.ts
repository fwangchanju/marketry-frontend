import type { HeatmapSectorNode } from '@/types/api'

export function sectorPathKey(parentPath: string, sectorName: string): string {
  return parentPath ? `${parentPath}>${sectorName}` : sectorName
}

export function indexSectorsByPath(nodes: HeatmapSectorNode[]): Map<string, HeatmapSectorNode> {
  const byPath = new Map<string, HeatmapSectorNode>()
  const visit = (sectors: HeatmapSectorNode[], parentPath = '') => {
    for (const sector of sectors) {
      const path = sectorPathKey(parentPath, sector.sectorName)
      byPath.set(path, sector)
      visit(sector.children, path)
    }
  }
  visit(nodes)
  return byPath
}
