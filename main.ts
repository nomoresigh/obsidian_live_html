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
            
            // 요청된 높이로 설정하되 overflow는 제거
            iframe.style.height = `${requestedHeight}px`;
            // iframe.style.overflow = 'hidden'; // 이 줄을 제거해서 콘텐츠가 잘리지 않게 함
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

      // Create iframe
      const iframe = el.createEl('iframe');
      iframe.classList.add('live-html-iframe');
      iframe.style.width = '100%';
      iframe.style.height = '200px';
      iframe.style.border = '1px solid var(--background-modifier-border)';
      iframe.style.borderRadius = '4px';
      iframe.style.backgroundColor = 'white';
      iframe.style.transition = 'height 0.3s ease';
      iframe.setAttribute('scrolling', 'no');
      // 모든 JavaScript 상호작용을 위한 완전한 sandbox 권한 부여
      iframe.sandbox.add('allow-scripts', 'allow-same-origin', 'allow-popups', 'allow-forms', 'allow-modals', 'allow-pointer-lock', 'allow-popups-to-escape-sandbox', 'allow-presentation', 'allow-top-navigation-by-user-activation');

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
            }
            
            /* 스크롤바만 숨김 */
            body::-webkit-scrollbar,
            html::-webkit-scrollbar {
              display: none;
            }
            
            body {
              scrollbar-width: none; /* Firefox */
              -ms-overflow-style: none; /* IE/Edge */
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
          </style>
        </head>
        <body>
          ${htmlSource}
          
          <script>
            let resizeCount = 0;
            const maxResizeAttempts = 5; // 시도 횟수를 늘림
            
            function sendHeight() {
              if (resizeCount >= maxResizeAttempts) return;
              
              const height = document.body.scrollHeight;
              resizeCount++;
              
              window.parent.postMessage({
                type: 'resize-iframe',
                height: height
              }, '*');
            }
            
            // DOM 변화 감지로 페이지 전환 시에도 크기 조절
            const observer = new MutationObserver(function(mutations) {
              let shouldResize = false;
              mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                  const target = mutation.target;
                  if (target.style.display !== 'none' && target.style.display !== '') {
                    shouldResize = true;
                  }
                } else if (mutation.type === 'childList') {
                  shouldResize = true;
                }
              });
              
              if (shouldResize) {
                resizeCount = 0; // 카운터 리셋
                setTimeout(sendHeight, 100);
                setTimeout(sendHeight, 300);
                setTimeout(sendHeight, 500);
              }
            });
            
            // body와 모든 자식 요소들 감시
            observer.observe(document.body, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ['style', 'class']
            });
            
            // 문서 로딩 완료 후 높이 전송
            if (document.readyState === 'complete') {
              sendHeight();
            } else {
              window.addEventListener('load', sendHeight);
            }
            
            // 이미지 로딩 완료 시 한 번 더
            const images = document.querySelectorAll('img');
            if (images.length > 0) {
              let loadedCount = 0;
              images.forEach(img => {
                if (img.complete) {
                  loadedCount++;
                  if (loadedCount === images.length) sendHeight();
                } else {
                  img.addEventListener('load', () => {
                    loadedCount++;
                    if (loadedCount === images.length) sendHeight();
                  });
                }
              });
            }
            
            // 창 크기 변경 시에도 높이 재계산
            window.addEventListener('resize', function() {
              resizeCount = 0;
              setTimeout(sendHeight, 100);
            });
            
            // 클릭 이벤트 발생 시에도 높이 재계산 (페이지 전환 감지)
            document.addEventListener('click', function() {
              setTimeout(function() {
                resizeCount = 0;
                sendHeight();
              }, 50);
              setTimeout(sendHeight, 200);
              setTimeout(sendHeight, 500);
            });
            
            // 주기적으로 높이 체크 (안전장치)
            setInterval(function() {
              const currentHeight = document.body.scrollHeight;
              if (Math.abs(currentHeight - (window.lastReportedHeight || 0)) > 50) {
                resizeCount = 0;
                window.lastReportedHeight = currentHeight;
                sendHeight();
              }
            }, 1000);
          </script>
          
          ${scripts.map(script => `<script>${script}</script>`).join('')}
          
          <script>
            // User scripts execution
            setTimeout(sendHeight, 100);
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