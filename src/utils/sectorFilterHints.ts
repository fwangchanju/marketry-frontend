// 같은 이름의 업종이 여러 부모 아래 있으면 상위 경로를 모두 보여준다.
export function buildSectorParentHints(paths: readonly (readonly string[])[]) {
  const parents = [new Map<string, Set<string>>(), new Map<string, Set<string>>()]
  for (const path of paths) {
    for (const depth of [1, 2]) {
      const name = path[depth]
      if (!name || name === '-') continue
      const parentPath = path.slice(0, depth).join(' > ')
      if (!parentPath) continue
      const entries = parents[depth - 1].get(name) ?? new Set<string>()
      entries.add(parentPath)
      parents[depth - 1].set(name, entries)
    }
  }
  const hints = parents.map(entries => new Map(
    [...entries].map(([name, paths]) => [name, [...paths].map(path => `상위 업종: ${path}`).join('\n')]),
  ))
  return { midSector: hints[0], subSector: hints[1] }
}
