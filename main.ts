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
            const minHeight = 100; // Minimum height
            
            // Prevent unnecessary updates by comparing with current height
            const currentHeight = parseInt(iframe.style.height) || 0;
            if (Math.abs(requestedHeight - currentHeight) < 5) {
              return; // Ignore changes less than 5px
            }
            
            // Update only within reasonable height range (max height limit removed)
            const newHeight = Math.max(requestedHeight, minHeight);
            
            iframe.style.height = `${newHeight}px`;
            iframe.style.overflow = 'hidden'; // Always hide scrollbar
            
            console.log(`Iframe resized to: ${newHeight}px (requested: ${requestedHeight}px, current: ${currentHeight}px)`);
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
      iframe.style.height = '200px'; // Set initial height smaller
      iframe.style.border = '1px solid var(--background-modifier-border)';
      iframe.style.borderRadius = '4px';
      iframe.style.backgroundColor = 'white';
      iframe.style.overflow = 'hidden';
      iframe.style.transition = 'height 0.3s ease'; // Set animation in advance
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
            // Previous height storage
            let lastReportedHeight = 0;
            let isInitialized = false;
            let resizeCount = 0;
            const maxResizeAttempts = 10; // Maximum resize attempts
            
            // Accurate height calculation function
            function calculateContentHeight() {
              try {
                // Prevent infinite loop
                if (resizeCount > maxResizeAttempts) {
                  console.warn('Maximum resize attempts exceeded, stopping resize');
                  return lastReportedHeight || 200;
                }
                
                const body = document.body;
                
                // Simple and safe height calculation (no max height limit)
                const contentHeight = body.scrollHeight;
                const minHeight = 100;
                
                let finalHeight = Math.max(contentHeight, minHeight);
                
                return Math.ceil(finalHeight);
              } catch (error) {
                console.warn('Height calculation error:', error);
                return lastReportedHeight || 200;
              }
            }
            
            // Height sending function
            let resizeTimeout;
            function sendHeight() {
              clearTimeout(resizeTimeout);
              resizeTimeout = setTimeout(() => {
                const height = calculateContentHeight();
                
                // Update only if height changed significantly (no max height limit)
                if (height && Math.abs(height - lastReportedHeight) > 10) {
                  resizeCount++;
                  lastReportedHeight = height;
                  
                  window.parent.postMessage({
                    type: 'resize-iframe',
                    height: height
                  }, '*');
                  
                  console.log('Iframe height updated: ' + height + 'px (attempt: ' + resizeCount + ')');
                }
              }, 100);
            }
            
            // Image loading completion detection
            function setupImageLoadListeners() {
              const images = document.querySelectorAll('img');
              
              if (images.length === 0) {
                setTimeout(sendHeight, 100);
                return;
              }
              
              let loadedImages = 0;
              function onImageLoad() {
                loadedImages++;
                if (loadedImages === images.length) {
                  setTimeout(sendHeight, 200);
                }
              }
              
              images.forEach(img => {
                if (img.complete) {
                  onImageLoad();
                } else {
                  img.addEventListener('load', onImageLoad);
                  img.addEventListener('error', onImageLoad);
                }
              });
            }
            
            // Initialization function
            function initialize() {
              if (isInitialized) return;
              isInitialized = true;
              
              setupImageLoadListeners();
              
              // Set initial height (only once)
              setTimeout(sendHeight, 200);
            }
            
            // Initialize after document loading complete
            if (document.readyState === 'complete') {
              initialize();
            } else {
              window.addEventListener('load', initialize);
            }
          </script>
          
          ${scripts.map(script => `<script>${script}</script>`).join('')}
          
          <script>
            // Recalculate height after user scripts execution
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