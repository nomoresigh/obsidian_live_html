import { Plugin } from 'obsidian';

// 이 클래스 정의부터가 파일의 시작입니다.
export default class LiveHtmlPlugin extends Plugin {

	// 플러그인이 로드될 때 실행되는 메인 함수
	async onload() {
		console.log('Loading Live HTML Preview Plugin with Auto-Height');

		// 'message' 이벤트를 처리할 핸들러 함수입니다.
		// iframe으로부터 높이 정보를 받아서 처리하는 역할을 합니다.
		const handleIframeMessage = (event: MessageEvent) => {
			// 1. 우리가 보낸 메시지가 맞는지 확인합니다.
			if (event.data && event.data.type === 'resize-iframe' && event.data.height) {

				// 2. 현재 문서에 있는 모든 'live-html-iframe'을 찾습니다.
				const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe.live-html-iframe');

				// 3. 메시지를 보낸 iframe을 정확히 찾아 높이를 조절합니다.
				iframes.forEach(iframe => {
					if (iframe.contentWindow === event.source) {
						const newHeight = event.data.height + 15; // 약간의 여유 공간을 줍니다.
						iframe.style.height = `${newHeight}px`;
					}
				});
			}
		};

		// Obsidian의 window 객체에 이벤트 리스너를 등록합니다.
		window.addEventListener('message', handleIframeMessage);

		// 플러그인이 비활성화될 때, 등록했던 이벤트 리스너를 깨끗하게 제거합니다.
		// 이렇게 해야 메모리 누수를 방지할 수 있습니다.
		this.register(() => {
			window.removeEventListener('message', handleIframeMessage);
		});

		// 'html-live' 코드 블록을 처리하는 메인 로직입니다.
		this.registerMarkdownCodeBlockProcessor('html-live', (source, el, ctx) => {

			// iframe 내부에 주입해서, 높이를 계산하고 부모에게 알려줄 JavaScript 코드입니다.
			const scriptToInject = `
        <script>
          try {
            const ro = new ResizeObserver(entries => {
              const height = document.documentElement.scrollHeight;
              window.parent.postMessage({
                type: 'resize-iframe',
                height: height
              }, '*');
            });
            ro.observe(document.body);
          } catch (e) {
            console.error("ResizeObserver not supported in this context.", e);
          }
        </script>
      `;

			// 사용자가 입력한 HTML 소스(source)에 우리가 만든 스크립트를 삽입합니다.
			let finalSource = source;
			if (finalSource.includes('</body>')) {
				finalSource = finalSource.replace('</body>', `${scriptToInject}</body>`);
			} else {
				finalSource += scriptToInject;
			}

			// 이제 iframe 엘리먼트를 생성합니다.
			const iframe = el.createEl('iframe');

			// 나중에 이 iframe을 쉽게 찾을 수 있도록 CSS 클래스를 추가합니다.
			iframe.classList.add('live-html-iframe');

			// iframe의 속성을 설정합니다.
			iframe.srcdoc = finalSource;
			iframe.style.width = '100%';
			iframe.style.height = '50px'; // 초기 높이는 작게 시작합니다.
			iframe.style.border = '1px solid var(--background-modifier-border)';
			iframe.style.borderRadius = '4px'; // 보기 좋게 모서리를 둥글게 합니다.
			iframe.sandbox.add('allow-scripts', 'allow-same-origin');
		});
	}

	// 플러그인이 언로드될 때 실행되는 함수 (지금은 비워둡니다)
	onunload() {
		console.log('Unloading Live HTML Preview Plugin');
	}
}