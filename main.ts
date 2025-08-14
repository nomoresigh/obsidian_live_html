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
            iframe.style.height = `${requestedHeight}px`;
          }
        });
      }
    };

    window.addEventListener('message', handleIframeMessage);

    this.register(() => {
      window.removeEventListener('message', handleIframeMessage);
    });

    this.registerMarkdownCodeBlockProcessor('html-live', (source, el, ctx) => {
      
      // Extract scripts
      const scripts: string[] = [];
      let htmlSource = source;
      
      // Extract all script tags
      const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
      let match;
      while ((match = scriptRegex.exec(source)) !== null) {
        scripts.push(match[1] || '');
      }
      
      // Remove script tags
      htmlSource = source.replace(scriptRegex, '');

      // Create iframe container for better isolation
      const container = el.createEl('div');
      container.style.position = 'relative';
      container.style.isolation = 'isolate'; // CSS isolation for stacking context
      container.style.zIndex = '1'; // Lower than Obsidian UI

      // Create iframe
      const iframe = container.createEl('iframe');
      iframe.classList.add('live-html-iframe');
      iframe.style.width = '100%';
      iframe.style.height = '200px';
      iframe.style.border = '1px solid var(--background-modifier-border)';
      iframe.style.borderRadius = '4px';
      iframe.style.backgroundColor = 'white';
      iframe.style.transition = 'height 0.3s ease';
      iframe.style.pointerEvents = 'auto'; // iframe 내부에서만 이벤트 허용
      iframe.setAttribute('scrolling', 'no');
      
      // 더 제한적인 sandbox 설정 - allow-modals 제거하여 alert/confirm 차단
      iframe.sandbox.add('allow-scripts', 'allow-same-origin', 'allow-popups-to-escape-sandbox', 'allow-forms');

      // Generate complete HTML document
      const fullHtmlDoc = `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Live Preview</title>
          <style>
            /* 기본 설정만 */
            * {
              box-sizing: border-box;
            }
            
            body, html {
              margin: 0;
              padding: 10px;
              width: 100%;
              height: auto;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              /* iframe 내부에서 모든 요소가 격리되도록 */
              position: relative;
              z-index: 1;
            }
            
            /* 스크롤바만 숨김 */
            body::-webkit-scrollbar,
            html::-webkit-scrollbar {
              display: none;
            }
            
            body {
              scrollbar-width: none; /* Firefox */
              -ms-overflow-style: none; /* IE/Edge */
              min-height: auto !important;
            }
            
            html {
              min-height: auto !important;
            }
            
            /* 모든 팝업/모달 요소가 iframe 내부에만 표시되도록 강제 */
            .modal, .popup, .overlay, .tooltip, 
            [class*="modal"], [class*="popup"], [class*="overlay"], [class*="tooltip"],
            [id*="modal"], [id*="popup"], [id*="overlay"], [id*="tooltip"] {
              max-width: 100% !important;
              max-height: 80vh !important;
              overflow: auto !important;
              /* iframe 경계를 벗어나지 않도록만 제한 */
              contain: layout !important;
            }
            
            /* 이미지 반응형 */
            img {
              max-width: 100%;
              height: auto;
            }
            
            /* 기본 요소들 */
            canvas {
              display: block;
              max-width: 100%;
            }
            
            video {
              max-width: 100%;
              height: auto;
            }
            
            /* 폼 요소 */
            input, textarea, select, button {
              max-width: 100%;
            }
            
            /* 뷰포트 단위 차단 */
            .container {
              min-height: auto !important;
            }
            
            /* sticky position 차단 */
            header {
              position: relative !important;
              top: auto !important;
            }
            
            /* 백드롭 필터 제거 */
            * {
              backdrop-filter: none !important;
              -webkit-backdrop-filter: none !important;
            }
          </style>
        </head>
        <body>
          ${htmlSource}
          
          <script>
            // 디바운싱을 위한 변수들
            let resizeTimeout;
            let lastReportedHeight = 0;
            let isProcessing = false;
            
            // 이벤트 전파 차단 함수
            function stopPropagationToParent(event) {
              if (event) {
                event.stopPropagation();
                event.stopImmediatePropagation();
              }
            }
            
            // 모든 키보드 이벤트가 iframe 내부에서만 처리되도록
            document.addEventListener('keydown', stopPropagationToParent, true);
            document.addEventListener('keyup', stopPropagationToParent, true);
            document.addEventListener('keypress', stopPropagationToParent, true);
            
            // 팝업/모달 관련 이벤트들도 격리
            document.addEventListener('focus', stopPropagationToParent, true);
            document.addEventListener('blur', stopPropagationToParent, true);
            
            // 브라우저 네이티브 팝업만 차단 (웹 UI는 그대로 유지)
            const originalAlert = window.alert;
            const originalConfirm = window.confirm;
            const originalPrompt = window.prompt;
            
            window.alert = function(message) {
              // 브라우저 네이티브 alert만 console.log로 처리
              console.log('Alert:', message);
              return;
            };
            
            window.confirm = function(message) {
              // 브라우저 네이티브 confirm만 auto-confirm
              console.log('Confirm:', message, '-> Auto confirmed');
              return true;
            };
            
            window.prompt = function(message, defaultValue) {
              // 브라우저 네이티브 prompt만 기본값 반환
              console.log('Prompt:', message, '-> Default value:', defaultValue);
              return defaultValue || '';
            };

            // 디바운싱된 높이 전송 함수
            function sendHeightDebounced(delay = 100) {
              if (isProcessing) return;
              
              clearTimeout(resizeTimeout);
              resizeTimeout = setTimeout(() => {
                sendHeight();
              }, delay);
            }
            
            function sendHeight() {
              if (isProcessing) return;
              isProcessing = true;
              
              try {
                // 단순하게 scrollHeight만 사용 - 팝업 제외 로직 제거
                const currentHeight = document.body.scrollHeight;
                
                // 높이 변화가 최소 5px 이상일 때만 전송
                if (Math.abs(currentHeight - lastReportedHeight) >= 5) {
                  lastReportedHeight = currentHeight;
                  
                  window.parent.postMessage({
                    type: 'resize-iframe',
                    height: currentHeight
                  }, '*');
                }
              } catch (error) {
                console.warn('Height calculation error:', error);
              } finally {
                // 짧은 딜레이 후 다시 처리 가능하도록
                setTimeout(() => {
                  isProcessing = false;
                }, 50);
              }
            }
            
            // 뷰포트 단위 제거 함수 (최적화됨)
            function removeViewportUnits() {
              const elementsWithStyle = document.querySelectorAll('[style*="vh"], [style*="vw"]');
              
              elementsWithStyle.forEach(element => {
                const styleAttr = element.getAttribute('style');
                if (!styleAttr) return;
                
                const viewportPatterns = [
                  { pattern: /min-height\s*:\s*[0-9.]+vh[^;]*/gi, replacement: 'min-height: auto' },
                  { pattern: /height\s*:\s*[0-9.]+vh[^;]*/gi, replacement: 'height: auto' },
                  { pattern: /max-height\s*:\s*[0-9.]+vh[^;]*/gi, replacement: 'max-height: none' },
                  { pattern: /min-height\s*:\s*calc\([^)]*vh[^)]*\)[^;]*/gi, replacement: 'min-height: auto' },
                  { pattern: /height\s*:\s*calc\([^)]*vh[^)]*\)[^;]*/gi, replacement: 'height: auto' },
                  { pattern: /max-height\s*:\s*calc\([^)]*vh[^)]*\)[^;]*/gi, replacement: 'max-height: none' }
                ];
                
                let newStyle = styleAttr;
                let modified = false;
                
                viewportPatterns.forEach(({pattern, replacement}) => {
                  if (pattern.test(newStyle)) {
                    newStyle = newStyle.replace(pattern, replacement);
                    modified = true;
                  }
                });
                
                if (modified) {
                  element.setAttribute('style', newStyle);
                }
              });
            }

            // 초기 뷰포트 단위 제거
            removeViewportUnits();
            
            // DOM 변경 감지 (최적화됨)
            let mutationTimeout;
            const observer = new MutationObserver(function(mutations) {
              let shouldResize = false;
              let shouldRemoveViewport = false;
              
              mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                  shouldResize = true;
                  shouldRemoveViewport = true;
                  
                  // position: fixed 강제 변경 제거 - 일반 웹 UI 그대로 유지
                  /*
                  mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Element node
                      const element = node;
                      if (element.style && element.style.position === 'fixed') {
                        element.style.position = 'absolute';
                      }
                      // 자식 요소들도 확인
                      const fixedElements = element.querySelectorAll ? element.querySelectorAll('[style*="position: fixed"], [style*="position:fixed"]') : [];
                      fixedElements.forEach(fixed => {
                        fixed.style.position = 'absolute';
                      });
                    }
                  });
                  */
                } else if (mutation.type === 'attributes') {
                  if (mutation.attributeName === 'style') {
                    const target = mutation.target;
                    const style = target.getAttribute('style') || '';
                    
                    // position: fixed 감지 및 변경 제거
                    /*
                    if (style.includes('position: fixed') || style.includes('position:fixed')) {
                      target.style.position = 'absolute';
                    }
                    */
                    
                    if (style.includes('vh') || style.includes('vw')) {
                      shouldRemoveViewport = true;
                    }
                    
                    if (style.includes('display') || style.includes('height') || style.includes('visibility')) {
                      shouldResize = true;
                    }
                  }
                }
              });
              
              // 뷰포트 단위 제거 (디바운싱)
              if (shouldRemoveViewport) {
                clearTimeout(mutationTimeout);
                mutationTimeout = setTimeout(removeViewportUnits, 50);
              }
              
              // 크기 조정 (디바운싱)
              if (shouldResize) {
                sendHeightDebounced(100);
              }
            });
            
            observer.observe(document.body, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ['style', 'class']
            });
            
            // 문서 로딩 완료 후 높이 전송
            if (document.readyState === 'complete') {
              sendHeightDebounced(100);
            } else {
              window.addEventListener('load', () => sendHeightDebounced(200));
            }
            
            // 이미지 로딩 완료 감지
            const images = document.querySelectorAll('img');
            if (images.length > 0) {
              let loadedCount = 0;
              const imageLoadHandler = () => {
                loadedCount++;
                if (loadedCount === images.length) {
                  sendHeightDebounced(300);
                }
              };
              
              images.forEach(img => {
                if (img.complete) {
                  imageLoadHandler();
                } else {
                  img.addEventListener('load', imageLoadHandler, { once: true });
                  img.addEventListener('error', imageLoadHandler, { once: true });
                }
              });
            }
            
            // 창 크기 변경 시 높이 재계산
            window.addEventListener('resize', () => sendHeightDebounced(200));
            
            // 클릭 이벤트 (페이지 전환 감지용, 최적화됨)
            document.addEventListener('click', (e) => {
              stopPropagationToParent(e);
              sendHeightDebounced(300);
            });
            
            // 주기적 높이 체크 (안전장치, 빈도 감소)
            setInterval(() => {
              if (!isProcessing) {
                const currentHeight = document.body.scrollHeight;
                if (Math.abs(currentHeight - lastReportedHeight) > 20) {
                  sendHeightDebounced(100);
                }
              }
            }, 2000); // 2초로 증가
            
            // 정리 함수들
            window.addEventListener('beforeunload', () => {
              clearTimeout(resizeTimeout);
              clearTimeout(mutationTimeout);
              observer.disconnect();
            });
          </script>
          
          ${scripts.map(script => `<script>${script}</script>`).join('')}
          
          <script>
            // 사용자 스크립트 실행 후 높이 재조정
            setTimeout(() => sendHeightDebounced(500), 100);
            
            // position: fixed 강제 변경 제거 - 일반 웹 UI 그대로 유지
            /*
            setTimeout(() => {
              const fixedElements = document.querySelectorAll('[style*="position: fixed"], [style*="position:fixed"]');
              fixedElements.forEach(element => {
                element.style.position = 'absolute';
              });
            }, 200);
            */
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