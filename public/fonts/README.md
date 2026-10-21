# Fonts

[Pretendard](https://github.com/orioncactus/pretendard) (SIL Open Font License 1.1) 한글/라틴/숫자를 단일 패밀리로
커버하는 전체 화면 기본 폰트다.

`pretendard/` 아래는 글자 범위별로 쪼갠 조각(dynamic subset, 굵기당 92개)이다. 브라우저는 화면에 나온 글자가
들어 있는 조각만 받는다. 파일 이름은 `Pretendard-<굵기>.subset.<번호>.woff2`이고 `src/index.css`의
`@font-face`가 조각마다 글자 범위(`unicode-range`)를 지정한다.

| 굵기 | 값 | 포함 |
|---|---|---|
| Regular | 400 | 예 |
| Medium | 500 | 예 |
| Bold | 700 | 예 |

600(SemiBold)을 요청하는 텍스트는 예전과 같이 700으로 그려진다. 굵기를 더하려면 npm `pretendard` 패키지의
`dist/web/static/woff2-dynamic-subset`에서 해당 굵기 조각을 `pretendard/`로 복사하고 `index.css`에 같은 형식의
`@font-face`를 추가한다.

`roboto-latin.woff2`는 숫자 표시용 Roboto 라틴 조각이다.

`font-family: "Pretendard", "Noto Sans KR", system-ui, sans-serif`로 사용한다.
