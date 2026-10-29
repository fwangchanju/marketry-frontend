import { pointerWithin, type CollisionDetection } from '@dnd-kit/core'

// 업종 번호 칸을 끌어 다른 업종으로 옮길 때는 커서가 들어간 줄이 목적지다.
// 번호 칸 왼쪽을 잡고 줄 오른쪽의 '여기'에 놓으면 번호 칸 절반이 줄 밖에 걸릴 수 있으므로 면적 기준을 쓰지 않는다.
export const sectorCollisionDetection: CollisionDetection = args => pointerWithin(args)
