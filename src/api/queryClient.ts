import { QueryClient, MutationCache } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { getErrorDetail } from '@/utils/errorMessage'
import { appAlert } from '@/utils/appDialogBus'

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.meta?.skipGlobalError) return
      const failure = mutation.options.meta?.failure
      appAlert(getErrorDetail(error, typeof failure === 'string' ? failure : undefined))
    },
  }),
  defaultOptions: {
    queries: {
      // staleTime/refetchInterval은 여기서 전역으로 정하지 않음 - 시장 데이터(수시 갱신)와
      // 참조 데이터(일 단위 갱신) 비중이 대등해서 어느 한쪽을 기본값으로 삼기 애매하고,
      // 지금은 훅 개수도 적어 각 훅이 hooks/cacheConfig의 프리셋을 명시적으로 선택해 씀.
      // 훅이 늘어나 반복이 부담되면 그때 전역 기본값 도입을 다시 고려.
      refetchOnWindowFocus: false,
      // 4xx는 요청 자체가 잘못됐거나 권한이 없다는 확정적인 응답이라 재시도해도 결과가 안 바뀐다
      // (예: admin 화이트리스트에 없는 IP의 403). 재시도는 네트워크 오류/5xx 같은 일시적 실패에만.
      retry: (failureCount, error) => {
        if (isAxiosError(error) && error.response && error.response.status < 500) return false
        return failureCount < 3
      },
    },
  },
})

export default queryClient
