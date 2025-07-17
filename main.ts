// live-html-plugin/main.ts

import { Plugin } from 'obsidian';

export default class LiveHtmlPlugin extends Plugin {

  async onload() {
    console.log('Loading Universal Live HTML Preview Plugin');

    const handleIframeMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'resize-iframe') {
        const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe.live-html-iframe');
        iframes.forEach(iframe => {
          if (iframe.contentWindow === event.source) {
            const requestedHeight = event.data.height || 0;
            const minHeight = 200; // 최소 높이
            const maxHeight = window.innerHeight * 0.8; // 최대 높이를 화면의 80%로 제한
            
            // 적절한 높이 계산
            let newHeight = Math.max(requestedHeight + 30, minHeight);
            if (newHeight > maxHeight) {
              newHeight = maxHeight;
              // 높이가 제한될 때는 스크롤 허용
              iframe.style.overflow = 'auto';
            } else {
              iframe.style.overflow = 'hidden';
            }
            
            iframe.style.height = `${newHeight}px`;
            
            // 디버깅 정보
            console.log(`Iframe resized to: ${newHeight}px (requested: ${requestedHeight}px)`);
          }
        });
      }
    };

    window.addEventListener('message', handleIframeMessage);

    this.register(() => {
      window.removeEventListener('message', handleIframeMessage);
    });

    this.registerMarkdownCodeBlockProcessor('html-live', (source, el, ctx) => {
      
      // 스크립트 추출
      const scripts: string[] = [];
      let htmlSource = source;
      
      // 모든 script 태그 추출
      const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
      let match;
      while ((match = scriptRegex.exec(source)) !== null) {
        scripts.push(match[1] || '');
      }
      
      // script 태그 제거
      htmlSource = source.replace(scriptRegex, '');

      // iframe 생성
      const iframe = el.createEl('iframe');
      iframe.classList.add('live-html-iframe');
      iframe.style.width = '100%';
      iframe.style.height = '400px'; // 초기 높이
      iframe.style.border = '1px solid var(--background-modifier-border)';
      iframe.style.borderRadius = '4px';
      iframe.style.backgroundColor = 'white';
      iframe.style.overflow = 'hidden';
      iframe.sandbox.add('allow-scripts', 'allow-same-origin', 'allow-popups', 'allow-forms');

      // 완전한 HTML 문서 생성
      const fullHtmlDoc = `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Live Preview</title>
          <style>
            /* 기본 리셋 */
            * {
              box-sizing: border-box;
            }
            
            body, html {
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              height: auto !important;
              min-height: 100vh !important;
              overflow-x: hidden !important;
              overflow-y: visible !important;
              position: static !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            /* 일반적인 요소들 */
            img {
              max-width: 100% !important;
              height: auto !important;
            }
            
            canvas {
              display: block !important;
              max-width: 100% !important;
            }
            
            /* 모달이나 팝업 요소들 */
            .modal, .popup, .overlay {
              position: fixed !important;
              z-index: 9999 !important;
            }
            
            /* 일반적인 컨테이너들 */
            .container, .wrapper, .content {
              width: 100% !important;
              max-width: 100% !important;
            }
            
            /* 그리드나 플렉스 레이아웃 */
            .grid, .flex {
              width: 100% !important;
            }
            
            /* 테이블 반응형 */
            table {
              width: 100% !important;
              max-width: 100% !important;
              overflow-x: auto !important;
            }
            
            /* 폼 요소들 */
            input, textarea, select, button {
              max-width: 100% !important;
            }
            
            /* 비디오와 iframe */
            video, iframe {
              max-width: 100% !important;
              height: auto !important;
            }
            
            /* 애니메이션 성능 개선 */
            * {
              -webkit-transform: translateZ(0);
              transform: translateZ(0);
            }
          </style>
        </head>
        <body>
          ${htmlSource}
          
          <script>
            // 범용 높이 계산 함수
            function calculateHeight() {
              const body = document.body;
              const html = document.documentElement;
              
              // 여러 방법으로 높이 계산
              const heights = [
                body.scrollHeight,
                body.offsetHeight,
                html.clientHeight,
                html.scrollHeight,
                html.offsetHeight
              ];
              
              // 모든 자식 요소들의 위치도 고려
              const allElements = document.querySelectorAll('*');
              let maxBottom = 0;
              
              allElements.forEach(el => {
                const rect = el.getBoundingClientRect();
                const bottom = rect.bottom + window.scrollY;
                if (bottom > maxBottom) {
                  maxBottom = bottom;
                }
              });
              
              heights.push(maxBottom);
              
              // 가장 큰 값 사용
              const finalHeight = Math.max(...heights.filter(h => h > 0));
              
              return Math.max(finalHeight, 200); // 최소 200px
            }
            
            // 높이 전송 함수
            function sendHeight() {
              try {
                const height = calculateHeight();
                window.parent.postMessage({
                  type: 'resize-iframe',
                  height: height
                }, '*');
              } catch (e) {
                console.error('Height calculation error:', e);
              }
            }
            
            // 이벤트 리스너 등록
            window.addEventListener('load', sendHeight);
            window.addEventListener('resize', sendHeight);
            document.addEventListener('DOMContentLoaded', sendHeight);
            
            // 이미지 로딩 완료 감지
            function setupImageListeners() {
              const images = document.querySelectorAll('img');
              images.forEach(img => {
                if (img.complete) {
                  sendHeight();
                } else {
                  img.addEventListener('load', sendHeight);
                  img.addEventListener('error', sendHeight);
                }
              });
            }
            
            // 동적 콘텐츠 변화 감지
            function setupObservers() {
              // ResizeObserver
              if (window.ResizeObserver) {
                const resizeObserver = new ResizeObserver(sendHeight);
                resizeObserver.observe(document.body);
                resizeObserver.observe(document.documentElement);
              }
              
              // MutationObserver
              const mutationObserver = new MutationObserver((mutations) => {
                let shouldResize = false;
                mutations.forEach(mutation => {
                  if (mutation.type === 'childList' || 
                      mutation.type === 'attributes' ||
                      mutation.type === 'characterData') {
                    shouldResize = true;
                  }
                });
                if (shouldResize) {
                  setTimeout(sendHeight, 100);
                }
              });
              
              mutationObserver.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                characterData: true,
                attributeFilter: ['style', 'class', 'width', 'height']
              });
            }
            
            // 초기화
            setTimeout(() => {
              setupImageListeners();
              setupObservers();
              sendHeight();
            }, 100);
            
            // 주기적 체크 (애니메이션이나 동적 변화 대응)
            setInterval(sendHeight, 2000);
            
            // 여러 시점에서 높이 재계산
            setTimeout(sendHeight, 500);
            setTimeout(sendHeight, 1000);
            setTimeout(sendHeight, 2000);
            setTimeout(sendHeight, 3000);
          </script>
          
          ${scripts.map(script => `<script>${script}</script>`).join('')}
          
          <script>
            // 사용자 스크립트 실행 후 높이 재계산
            setTimeout(() => {
              sendHeight();
              setupImageListeners();
            }, 500);
          </script>
        </body>
        </html>
      `;

      iframe.srcdoc = fullHtmlDoc;
    });
  }

  onunload() {
    console.log('Unloading Universal Live HTML Preview Plugin');
  }
}