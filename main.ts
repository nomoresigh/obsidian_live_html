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
            const maxHeight = window.innerHeight * 0.9; // 최대 높이를 화면의 90%로 증가
            
            // 적절한 높이 계산
            let newHeight = Math.max(requestedHeight + 20, minHeight); // 패딩 줄이기
            if (newHeight > maxHeight) {
              newHeight = maxHeight;
              iframe.style.overflow = 'auto';
            } else {
              iframe.style.overflow = 'hidden';
            }
            
            // 부드러운 애니메이션 추가
            iframe.style.transition = 'height 0.2s ease-out';
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
      iframe.style.height = '200px'; // 초기 높이를 더 작게 설정
      iframe.style.border = '1px solid var(--background-modifier-border)';
      iframe.style.borderRadius = '4px';
      iframe.style.backgroundColor = 'white';
      iframe.style.overflow = 'hidden';
      iframe.style.transition = 'height 0.3s ease'; // 애니메이션 미리 설정
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
              padding: 10px !important;
              width: 100% !important;
              height: auto !important;
              min-height: auto !important;
              overflow-x: hidden !important;
              overflow-y: visible !important;
              position: static !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
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
          </style>
        </head>
        <body>
          ${htmlSource}
          
          <script>
            // 이전 높이 저장
            let lastReportedHeight = 0;
            let isInitialized = false;
            
            // 정확한 높이 계산 함수
            function calculateContentHeight() {
              try {
                // 모든 콘텐츠가 로드될 때까지 대기
                if (document.readyState !== 'complete' && !isInitialized) {
                  return null;
                }
                
                const body = document.body;
                const html = document.documentElement;
                
                // 여러 방법으로 높이 계산
                const scrollHeight = Math.max(
                  body.scrollHeight,
                  body.offsetHeight,
                  html.clientHeight,
                  html.scrollHeight,
                  html.offsetHeight
                );
                
                // body의 실제 bounding rect 확인
                const bodyRect = body.getBoundingClientRect();
                const bodyHeight = bodyRect.height;
                
                // 자식 요소들의 실제 높이 계산
                let maxChildBottom = 0;
                const children = Array.from(body.children);
                
                children.forEach(child => {
                  if (child instanceof HTMLElement) {
                    const rect = child.getBoundingClientRect();
                    const style = window.getComputedStyle(child);
                    
                    // 숨겨진 요소는 제외
                    if (style.display === 'none' || style.visibility === 'hidden') {
                      return;
                    }
                    
                    const marginBottom = parseFloat(style.marginBottom) || 0;
                    const childBottom = rect.bottom - bodyRect.top + marginBottom;
                    maxChildBottom = Math.max(maxChildBottom, childBottom);
                  }
                });
                
                // 가장 큰 값 사용하되 최소/최대 제한
                let finalHeight = Math.max(scrollHeight, bodyHeight, maxChildBottom);
                
                // body padding 추가
                const bodyStyle = window.getComputedStyle(body);
                const paddingTop = parseFloat(bodyStyle.paddingTop) || 0;
                const paddingBottom = parseFloat(bodyStyle.paddingBottom) || 0;
                finalHeight += paddingTop + paddingBottom;
                
                // 최소 높이 보장
                finalHeight = Math.max(finalHeight, 50);
                
                return Math.ceil(finalHeight);
              } catch (error) {
                console.warn('높이 계산 오류:', error);
                return 200;
              }
            }
            
            // 높이 전송 함수
            let resizeTimeout;
            function sendHeight() {
              clearTimeout(resizeTimeout);
              resizeTimeout = setTimeout(() => {
                const height = calculateContentHeight();
                
                if (height !== null && Math.abs(height - lastReportedHeight) > 2) {
                  lastReportedHeight = height;
                  
                  window.parent.postMessage({
                    type: 'resize-iframe',
                    height: height
                  }, '*');
                  
                  console.log('Iframe 높이 업데이트:', height + 'px');
                }
              }, 50);
            }
            
            // 이미지 로딩 완료 감지
            function setupImageLoadListeners() {
              const images = document.querySelectorAll('img');
              let loadedImages = 0;
              const totalImages = images.length;
              
              if (totalImages === 0) {
                sendHeight();
                return;
              }
              
              function onImageLoad() {
                loadedImages++;
                sendHeight();
                
                if (loadedImages === totalImages) {
                  console.log('모든 이미지 로딩 완료');
                }
              }
              
              images.forEach(img => {
                if (img.complete && img.naturalHeight !== 0) {
                  onImageLoad();
                } else {
                  img.addEventListener('load', onImageLoad);
                  img.addEventListener('error', onImageLoad);
                }
              });
            }
            
            // DOM 변화 감지
            function setupMutationObserver() {
              const observer = new MutationObserver((mutations) => {
                let shouldResize = false;
                
                mutations.forEach(mutation => {
                  if (mutation.type === 'childList') {
                    shouldResize = true;
                  } else if (mutation.type === 'attributes') {
                    const target = mutation.target;
                    if (target instanceof HTMLElement) {
                      const affectsLayout = ['style', 'class', 'width', 'height'].includes(mutation.attributeName);
                      if (affectsLayout) {
                        shouldResize = true;
                      }
                    }
                  }
                });
                
                if (shouldResize) {
                  sendHeight();
                }
              });
              
              observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class', 'width', 'height']
              });
            }
            
            // 초기화 함수
            function initialize() {
              isInitialized = true;
              setupImageLoadListeners();
              setupMutationObserver();
              
              // 여러 시점에서 높이 계산
              sendHeight();
              setTimeout(sendHeight, 100);
              setTimeout(sendHeight, 300);
              setTimeout(sendHeight, 500);
            }
            
            // 문서 상태에 따른 초기화
            if (document.readyState === 'complete') {
              initialize();
            } else {
              window.addEventListener('load', initialize);
              document.addEventListener('DOMContentLoaded', () => {
                setTimeout(initialize, 50);
              });
            }
            
            // 창 크기 변경 시 높이 재계산
            window.addEventListener('resize', sendHeight);
          </script>
          
          ${scripts.map(script => `<script>${script}</script>`).join('')}
          
          <script>
            // 사용자 스크립트 실행 후 높이 재계산
            setTimeout(() => {
              if (typeof sendHeight === 'function') {
                sendHeight();
                setupImageLoadListeners();
              }
            }, 100);
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