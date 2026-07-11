/**
 * 2단계(콘텐츠 확장)에서 구현 예정: Unsplash/Pixabay API로 장르 키워드 기반
 * 소스 이미지를 자동 검색해 tools/source-images/에 받아오는 역할.
 * 1단계(현재)는 수동으로 받은 이미지를 tools/source-images/에 직접 배치해 사용한다.
 */
export async function fetchSourceImage(_genre: string): Promise<never> {
  throw new Error('imageSource는 2단계에서 구현 예정입니다. 1단계에서는 tools/source-images/에 이미지를 수동으로 배치하세요.');
}
