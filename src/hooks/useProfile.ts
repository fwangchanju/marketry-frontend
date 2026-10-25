import { useMutation, useQueryClient } from '@tanstack/react-query'
import { checkNicknameAvailability, deleteProfileImage, updateNickname, uploadProfileImage } from '@/api/profile'
import { authKeys } from './queryKeys'

// 프로필 값은 세션 응답(닉네임·사진 버전)에서만 읽는다 — 저장·삭제가 끝나면 세션을 다시 받아 화면 전체가 새 값을 쓰게 한다.
function useInvalidateSession() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: authKeys.session() })
}

export function useUpdateNickname() {
  const invalidateSession = useInvalidateSession()
  return useMutation({ mutationFn: updateNickname, onSuccess: invalidateSession })
}

// 등록 전에 이 닉네임을 쓸 수 있는지 서버에 묻는다(저장하지 않는다).
export function useCheckNickname() {
  // 검색 결과는 입력창 바로 아래에서 안내하므로 공통 요청 실패 팝업은 띄우지 않는다.
  return useMutation({ mutationFn: checkNicknameAvailability, meta: { skipGlobalError: true } })
}

export function useUploadProfileImage() {
  const invalidateSession = useInvalidateSession()
  return useMutation({ mutationFn: uploadProfileImage, onSuccess: invalidateSession })
}

export function useDeleteProfileImage() {
  const invalidateSession = useInvalidateSession()
  return useMutation({ mutationFn: deleteProfileImage, onSuccess: invalidateSession })
}
