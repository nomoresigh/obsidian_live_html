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
      iframe.setAttribute('scrolling', 'no'); // 스크롤 다시 비활성화
      iframe.sandbox.add('allow-scripts', 'allow-same-origin', 'allow-popups', 'allow-forms');

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
            const maxResizeAttempts = 3; // 단순하게 3번만 시도
            
            function sendHeight() {
              if (resizeCount >= maxResizeAttempts) return; // 무한루프 방지만
              
              const height = document.body.scrollHeight;
              resizeCount++;
              
              window.parent.postMessage({
                type: 'resize-iframe',
                height: height
              }, '*');
            }
            
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