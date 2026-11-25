import type { PathCrumb } from '@/components/PathBar'

// 화면 경로에서 차트 경로를 만든다. 업종 이름과 그 업종 직속 종목 묶음의 이름이 같으면 한 번만 쓴다.
export const chartSectorPath = (crumbs: PathCrumb[]) => crumbs.slice(1).map(crumb => crumb.label).filter((label, index, labels) => label !== labels[index - 1])
