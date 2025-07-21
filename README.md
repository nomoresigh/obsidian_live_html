# obsidian_live_html

**이 플러그인은 디시인사이드 비공갤 깡갤 대피소에서 배포되었습니다. 해당 플러그인을 다른 곳에 소개하거나 언급할 때는 출처를 밝혀주시면 감사하겠습니다.**

Obsidian 노트 안에서 HTML, CSS, JavaScript 코드를 실시간으로 렌더링하여 미리 볼 수 있게 해주는 플러그인입니다. 웹 개발 스니펫을 저장하거나, 인터랙티브한 차트를 만들거나, 간단한 UI 프로토타이핑을 Obsidian 내에서 직접 해결하세요.

## 주요 기능 (Features)

-   `html-live` 코드 블록을 사용하여 HTML을 즉시 렌더링합니다.
-   `<style>` 태그를 포함한 내부 CSS를 지원합니다.
-   `<script>` 태그를 포함한 내부 JavaScript를 obsidian 내의 `iframe` 환경에서 실행합니다.
-   별도의 창 없이 Obsidian 노트 내에서 바로 결과를 확인할 수 있습니다.

## 사용 방법 (How to Use)

1.  플러그인을 설치하고 활성화합니다.
2.  Obsidian 노트에 새로운 코드 블록을 만듭니다.
3.  코드 블록의 언어를 `html-live`로 지정합니다.
4.  코드 블록 안에 원하는 HTML, CSS, JavaScript 코드를 작성합니다.

## 주의사항

모든 코드는 iframe 내부의 격리된 샌드박스 환경에서 실행됩니다. 따라서 Obsidian의 다른 노트나 파일 시스템에 직접 접근할 수 없습니다.
외부 라이브러리(예: D3.js, Chart.js)를 사용하려면 <script src="URL"> 태그를 HTML 코드 안에 직접 포함해야 합니다.
