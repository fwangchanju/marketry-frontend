import client from './client'
import { ProfileResponseSchema } from '@/types/api'

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
