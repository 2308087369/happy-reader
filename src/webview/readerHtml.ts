import * as vscode from 'vscode';

export function getReaderHtml(webview: vscode.Webview): string {
	const nonce = createNonce();

	return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8" />
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>Happy Reader</title>
	<style>
		:root {
			color-scheme: light dark;
		}
		body {
			margin: 0;
			font-family: var(--vscode-font-family);
			background: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
		}
		.app {
			display: grid;
			grid-template-columns: 280px 1fr;
			height: 100vh;
		}
		.sidebar {
			border-right: 1px solid var(--vscode-sideBar-border);
			display: flex;
			flex-direction: column;
			min-height: 0;
		}
		.sidebar h3 {
			margin: 0;
			padding: 12px;
			font-size: 13px;
			border-bottom: 1px solid var(--vscode-sideBar-border);
		}
		.chapter-list {
			padding: 8px;
			overflow-y: auto;
			display: flex;
			flex-direction: column;
			gap: 4px;
		}
		.chapter-btn {
			border: 1px solid transparent;
			background: transparent;
			color: inherit;
			text-align: left;
			padding: 6px 8px;
			border-radius: 6px;
			cursor: pointer;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.chapter-btn:hover {
			background: var(--vscode-list-hoverBackground);
		}
		.chapter-btn.active {
			background: var(--vscode-list-activeSelectionBackground);
			color: var(--vscode-list-activeSelectionForeground);
		}
		.main {
			display: flex;
			flex-direction: column;
			min-width: 0;
			min-height: 0;
		}
		.toolbar {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 10px 12px;
			border-bottom: 1px solid var(--vscode-editorGroup-border);
		}
		.toolbar .spacer {
			flex: 1;
		}
		.button {
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			border-radius: 4px;
			padding: 6px 10px;
			cursor: pointer;
		}
		.button.secondary {
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
		}
		.content {
			overflow-y: auto;
			padding: 24px min(8vw, 72px);
			line-height: 1.8;
			font-size: 18px;
			white-space: pre-wrap;
		}
		.content.paper {
			background: #f7f0dc;
			color: #2b2b2b;
		}
		.content.dark {
			background: #1f1f1f;
			color: #d8d8d8;
		}
		.book-title {
			font-size: 13px;
			opacity: 0.8;
		}
		.chapter-title {
			font-size: 20px;
			font-weight: 600;
			margin-bottom: 16px;
		}
	</style>
</head>
<body>
	<div class="app">
		<div class="sidebar">
			<h3>章节目录</h3>
			<div class="chapter-list" id="chapterList"></div>
		</div>
		<div class="main">
			<div class="toolbar">
				<button class="button secondary" id="prevBtn">上一章</button>
				<button class="button secondary" id="nextBtn">下一章</button>
				<button class="button secondary" id="decreaseFontBtn">A-</button>
				<button class="button secondary" id="increaseFontBtn">A+</button>
				<button class="button secondary" id="lineHeightBtn">行距</button>
				<div class="spacer"></div>
				<button class="button" id="themeBtn">主题</button>
			</div>
			<div class="content" id="content"></div>
		</div>
	</div>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		const chapterListEl = document.getElementById('chapterList');
		const contentEl = document.getElementById('content');
		const prevBtn = document.getElementById('prevBtn');
		const nextBtn = document.getElementById('nextBtn');
		const decreaseFontBtn = document.getElementById('decreaseFontBtn');
		const increaseFontBtn = document.getElementById('increaseFontBtn');
		const lineHeightBtn = document.getElementById('lineHeightBtn');
		const themeBtn = document.getElementById('themeBtn');
		const stored = vscode.getState();
		const model = {
			book: null,
			chapters: [],
			currentChapter: stored?.currentChapter ?? 0,
			fontSize: stored?.fontSize ?? 18,
			lineHeight: stored?.lineHeight ?? 1.8,
			theme: stored?.theme ?? 'paper'
		};

		function persist() {
			vscode.setState({
				currentChapter: model.currentChapter,
				fontSize: model.fontSize,
				lineHeight: model.lineHeight,
				theme: model.theme
			});
		}

		function postProgress() {
			if (!model.book || model.chapters.length === 0) {
				return;
			}
			const progress = (model.currentChapter + 1) / model.chapters.length;
			vscode.postMessage({
				command: 'setProgress',
				data: {
					bookId: model.book.id,
					currentChapter: model.currentChapter,
					progress,
					fontSize: model.fontSize,
					lineHeight: model.lineHeight,
					theme: model.theme
				}
			});
			persist();
		}

		function renderChapters() {
			chapterListEl.innerHTML = '';
			model.chapters.forEach((chapter, index) => {
				const btn = document.createElement('button');
				btn.className = 'chapter-btn';
				if (index === model.currentChapter) {
					btn.classList.add('active');
				}
				btn.textContent = chapter.title;
				btn.addEventListener('click', () => {
					model.currentChapter = index;
					render();
					postProgress();
				});
				chapterListEl.appendChild(btn);
			});
		}

		function renderContent() {
			const chapter = model.chapters[model.currentChapter];
			if (!chapter || !model.book) {
				contentEl.innerHTML = '<p>未加载书籍</p>';
				return;
			}
			contentEl.className = 'content ' + model.theme;
			contentEl.style.fontSize = model.fontSize + 'px';
			contentEl.style.lineHeight = String(model.lineHeight);
			contentEl.scrollTop = 0;
			contentEl.innerHTML = '<div class="book-title">' + model.book.title + '</div><div class="chapter-title">' + chapter.title + '</div>' + escapeHtml(chapter.content).replace(/\\n/g, '<br/>');
		}

		function render() {
			renderChapters();
			renderContent();
		}

		function moveChapter(delta) {
			const next = model.currentChapter + delta;
			if (next < 0 || next >= model.chapters.length) {
				return;
			}
			model.currentChapter = next;
			render();
			postProgress();
		}

		function escapeHtml(input) {
			return input
				.replaceAll('&', '&amp;')
				.replaceAll('<', '&lt;')
				.replaceAll('>', '&gt;')
				.replaceAll('"', '&quot;')
				.replaceAll("'", '&#39;');
		}

		prevBtn.addEventListener('click', () => moveChapter(-1));
		nextBtn.addEventListener('click', () => moveChapter(1));
		decreaseFontBtn.addEventListener('click', () => {
			model.fontSize = Math.max(12, model.fontSize - 1);
			renderContent();
			postProgress();
		});
		increaseFontBtn.addEventListener('click', () => {
			model.fontSize = Math.min(36, model.fontSize + 1);
			renderContent();
			postProgress();
		});
		lineHeightBtn.addEventListener('click', () => {
			if (model.lineHeight < 1.7) {
				model.lineHeight = 1.8;
			} else if (model.lineHeight < 2) {
				model.lineHeight = 2.2;
			} else {
				model.lineHeight = 1.5;
			}
			renderContent();
			postProgress();
		});
		themeBtn.addEventListener('click', () => {
			model.theme = model.theme === 'paper' ? 'dark' : 'paper';
			renderContent();
			postProgress();
		});

		window.addEventListener('message', (event) => {
			const message = event.data;
			if (message.command === 'loadBook') {
				model.book = message.data.book;
				model.chapters = message.data.chapters;
				model.currentChapter = Math.min(message.data.reading.currentChapter, model.chapters.length - 1);
				model.fontSize = message.data.reading.fontSize;
				model.lineHeight = message.data.reading.lineHeight;
				model.theme = message.data.reading.theme;
				render();
				postProgress();
			}
		});

		vscode.postMessage({ command: 'ready' });
	</script>
</body>
</html>`;
}

function createNonce(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let value = '';
	for (let i = 0; i < 32; i += 1) {
		value += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return value;
}
