import { useState } from 'react'
import { appConfirm } from '@/utils/appDialogBus'
import {
  useSnapshots,
  useCurrentSnapshot,
  useSaveSnapshot,
  useOverwriteSnapshot,
  useRestoreSnapshot,
  useDeleteSnapshot,
} from '@/hooks/useTreemapCustom'
import Spinner from './Spinner'

export default function AdminVersionSaveSection() {
  const [label, setLabel] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const { data: versions, isLoading: isVersionsLoading } = useSnapshots()
  const { data: currentVersion, isLoading: isCurrentVersionLoading } = useCurrentSnapshot()
  const isLoading = isVersionsLoading || isCurrentVersionLoading
  const saveVersion = useSaveSnapshot()
  const overwriteVersion = useOverwriteSnapshot()
  const restoreVersion = useRestoreSnapshot()
  const deleteVersion = useDeleteSnapshot()

  const handleLabelChange = (value: string) => {
    setLabel(value)
    setSelectedId(null)
  }

  const handleSelect = (id: number, versionLabel: string) => {
    setSelectedId(id)
    setLabel(versionLabel)
  }

  const handleRestore = async (id: number, versionLabel: string) => {
    if (!await appConfirm(`[${versionLabel}]\n불러오시겠습니까?`, { title: '버전 불러오기' })) return
    restoreVersion.mutate(id)
  }

  const handleDelete = async (id: number, versionLabel: string) => {
    if (!await appConfirm(`[${versionLabel}]\n삭제하시겠습니까?`, { title: '버전 삭제' })) return
    deleteVersion.mutate(id)
    if (selectedId === id) {
      setSelectedId(null)
      setLabel('')
    }
  }

  const handleSubmit = () => {
    const trimmed = label.trim()
    if (!trimmed) return
    if (selectedId !== null) {
      overwriteVersion.mutate({ id: selectedId, label: trimmed })
    } else {
      saveVersion.mutate(trimmed)
    }
    setLabel('')
    setSelectedId(null)
  }

  return (
    <div className="border-t border-gray-700 p-4">
      <p className="mb-2 font-bold text-white">버전관리</p>
      <div className="flex flex-col gap-1 border-b border-gray-700 pb-2">
        <span className="text-xs text-white">현재버전</span>
        {isLoading ? (
          <div className="flex justify-center p-2">
            <Spinner className="h-5 w-5" />
          </div>
        ) : currentVersion ? (
          <div className="nes-container is-rounded is-dark flex w-full flex-col gap-1 px-2 py-1 text-white">
            <span className="truncate text-[14px]">이름 : {currentVersion.label}</span>
            <span className="text-[14px]">저장 : {currentVersion.createdAt.slice(0, 10)}</span>
          </div>
        ) : (
          <span className="text-xs font-medium text-gray-300">없음</span>
        )}
      </div>
      <div className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto">
        {versions?.map(version => (
          <div
            key={version.id}
            className={`group nes-container is-rounded is-dark flex items-center gap-2 px-2 py-1 text-white ${
              selectedId === version.id ? 'border-2 border-[var(--accent)]' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => handleSelect(version.id, version.label)}
              className="flex min-w-0 flex-1 flex-col truncate border-0 bg-transparent text-left text-white"
            >
              <span className="truncate text-[14px]">이름 : {version.label}</span>
              <span className="text-[14px]">저장 : {version.createdAt.slice(0, 10)}</span>
            </button>
            <div className="flex shrink-0 items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => handleRestore(version.id, version.label)}
                data-hint="불러오기"
                aria-label="불러오기"
                className="nes-btn border-[var(--accent)] bg-[var(--accent)] px-2 py-0.5 text-sm text-black hover:brightness-125"
              >
                ⤴
              </button>
              <button
                type="button"
                onClick={() => handleDelete(version.id, version.label)}
                data-hint="삭제"
                aria-label="삭제"
                className="nes-btn border-red-600 bg-red-600 px-2 py-0.5 text-sm text-white hover:bg-red-700"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-col gap-1">
        <input
          type="text"
          className="nes-input is-dark h-9 text-base focus:placeholder:text-transparent"
          value={label}
          onChange={e => handleLabelChange(e.target.value)}
          placeholder="버전 태그명"
        />
        <button type="button" className="nes-btn is-save text-xs" onClick={handleSubmit}>
          {selectedId !== null ? '덮어쓰기' : '저장'}
        </button>
      </div>
    </div>
  )
}
