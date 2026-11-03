import { useProfileImageSrc } from '@/hooks/useProfileImageSrc'

// 올린 사진은 모서리가 각진 정사각형 JPEG라서 기본 이미지와 같은 둥근 사각형으로 잘라 보여준다.
export default function ProfileAvatar({ className = '', lightMode = false }: { className?: string; lightMode?: boolean }) {
  const { src, onError } = useProfileImageSrc(lightMode)
  return <img src={src} alt="" onError={onError} className={`rounded-[12%] ${className}`} />
}
