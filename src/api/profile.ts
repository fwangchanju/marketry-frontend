import client from './client'
import { NicknameAvailabilityResponseSchema, ProfileResponseSchema } from '@/types/api'

export const checkNicknameAvailability = (nickname: string) =>
  client
    .get('/profile/nickname/availability', { params: { nickname } })
    .then(r => NicknameAvailabilityResponseSchema.parse(r.data))

export const updateNickname = (nickname: string) =>
  client.put('/profile/nickname', { nickname }).then(r => ProfileResponseSchema.parse(r.data))

// 기본 요청 헤더가 JSON이라 FormData를 그대로 보내면 axios가 JSON으로 바꿔 파일이 사라진다 — 요청 단위로 multipart를 지정한다.
export const uploadProfileImage = (image: Blob) => {
  const form = new FormData()
  form.append('file', image, 'profile.jpg')
  return client
    .put('/profile/image', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then(r => ProfileResponseSchema.parse(r.data))
}

export const deleteProfileImage = () => client.delete('/profile/image')

// 회원 탈퇴 — 이메일·프로필·내 분류·설정을 즉시 모두 지운다(되돌릴 수 없다). 관리자는 서버가 거부한다.
export const withdrawAccount = () => client.delete('/profile/account')
