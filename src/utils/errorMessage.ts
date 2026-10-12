import { isAxiosError } from 'axios'

const DEFAULT_ERROR_MESSAGE = '요청 처리 중 오류가 발생했습니다.'

// failure는 어떤 작업이 실패했는지("업종을 추가하지 못했습니다.") — 서버가 사유를 주지 않았을 때만 쓴다.
export function getErrorDetail(error: unknown, failure?: string): string {
  if (isAxiosError(error) && typeof error.response?.data?.detail === 'string') {
    return error.response.data.detail
  }
  return failure ? `${failure}\n잠시 후 다시 시도해 주세요.` : DEFAULT_ERROR_MESSAGE
}
