import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import { BookItem, BookReadingState, BookStore } from './library/bookStore';
import { parseTxtChapters } from './library/txtParser';
import { BookShelfProvider } from './providers/bookShelfView';
import { getReaderHtml } from './webview/readerHtml';

export function activate(context: vscode.ExtensionContext) {
	const store = new BookStore(context);
	const shelfProvider = new BookShelfProvider(store);
	let readerView: vscode.WebviewView | undefined;
	let readerReady = false;
	let pendingBook: BookItem | undefined;
	let loadToken = 0;
	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBar.text = 'Happy Reader';
	statusBar.show();

	const renderStatus = (book: BookItem) => {
		const percent = Math.round(book.reading.progress * 100);
		statusBar.text = `$(book) ${book.title} ${percent}%`;
	};

	const resolveBookArg = (value: unknown): BookItem | undefined => {
		if (!value || typeof value !== 'object') {
			return undefined;
		}
		const obj = value as Record<string, unknown>;
		if (typeof obj.id === 'string' && typeof obj.title === 'string' && typeof obj.filePath === 'string') {
			return obj as unknown as BookItem;
		}
		if (obj.book && typeof obj.book === 'object') {
			return obj.book as BookItem;
		}
		return undefined;
	};

	const loadBookToReader = async (book: BookItem) => {
		if (!readerView || !readerReady) {
			return;
		}
		const currentToken = ++loadToken;
		try {
			const content = await fs.readFile(book.filePath, 'utf8');
			const chapters = parseTxtChapters(content);
			if (currentToken !== loadToken || !readerView || !readerReady) {
				return;
			}
			await store.markOpened(book.id);
			const latest = store.getBookById(book.id) ?? book;
			await readerView.webview.postMessage({
				command: 'loadBook',
				data: {
					book: latest,
					chapters,
					reading: latest.reading
				}
			});
			if (pendingBook?.id === book.id) {
				pendingBook = undefined;
			}
			renderStatus(latest);
			shelfProvider.refresh();
		} catch {
			vscode.window.showErrorMessage(`读取文件失败：${book.filePath}`);
		}
	};

	const handleReaderMessage = async (message: { command?: string; data?: unknown }) => {
		if (message.command === 'ready') {
			readerReady = true;
			if (pendingBook) {
				await loadBookToReader(pendingBook);
			}
			return;
		}

		if (message.command === 'setProgress') {
			const payload = message.data as { bookId: string } & Partial<BookReadingState>;
			if (!payload.bookId) {
				return;
			}
			await store.updateReading(payload.bookId, {
				currentChapter: payload.currentChapter,
				progress: payload.progress,
				fontSize: payload.fontSize,
				lineHeight: payload.lineHeight,
				theme: payload.theme
			});
			const latest = store.getBookById(payload.bookId);
			if (latest) {
				renderStatus(latest);
			}
			shelfProvider.refresh();
		}
	};

	const readerViewProvider: vscode.WebviewViewProvider = {
		resolveWebviewView(webviewView) {
			readerView = webviewView;
			readerReady = false;
			webviewView.webview.options = {
				enableScripts: true
			};
			webviewView.webview.html = getReaderHtml(webviewView.webview);
			webviewView.webview.onDidReceiveMessage(handleReaderMessage);
			webviewView.onDidDispose(() => {
				if (readerView === webviewView) {
					readerView = undefined;
					readerReady = false;
				}
			});
		}
	};

	const openBook = async (book: BookItem) => {
		pendingBook = book;
		renderStatus(book);
		await vscode.commands.executeCommand('happyReader.reader.focus');
		await loadBookToReader(book);
	};

	const addBooksCommand = vscode.commands.registerCommand('happy-reader.addBooks', async () => {
		const selected = await vscode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: true,
			filters: {
				TXT: ['txt']
			},
			openLabel: '导入到书架'
		});

		if (!selected || selected.length === 0) {
			return;
		}

		const count = await store.upsertBooks(selected.map((item) => item.fsPath));
		shelfProvider.refresh();
		vscode.window.showInformationMessage(`已导入 ${count} 本书`);
	});

	const openBookCommand = vscode.commands.registerCommand('happy-reader.openBook', async (bookArg?: unknown) => {
		let target = resolveBookArg(bookArg);
		if (!target) {
			const books = store.getBooks();
			if (books.length === 0) {
				vscode.window.showInformationMessage('书架为空，请先导入 TXT 文件');
				return;
			}
			const selected = await vscode.window.showQuickPick(
				books.map((item) => ({
					label: item.title,
					description: `${Math.round(item.reading.progress * 100)}%`,
					item
				})),
				{
					placeHolder: '选择一本书打开'
				}
			);
			target = selected?.item;
		}

		if (!target) {
			return;
		}

		await openBook(target);
	});

	const refreshCommand = vscode.commands.registerCommand('happy-reader.refreshBookshelf', () => {
		shelfProvider.refresh();
	});

	const removeBookCommand = vscode.commands.registerCommand('happy-reader.removeBook', async (bookArg?: unknown) => {
		const target = resolveBookArg(bookArg);
		if (!target) {
			return;
		}
		const result = await vscode.window.showWarningMessage(`确认移除《${target.title}》?`, { modal: true }, '移除');
		if (result !== '移除') {
			return;
		}
		await store.removeBook(target.id);
		if (pendingBook?.id === target.id) {
			pendingBook = undefined;
		}
		shelfProvider.refresh();
	});

	context.subscriptions.push(
		statusBar,
		vscode.window.registerTreeDataProvider('happyReader.bookshelf', shelfProvider),
		vscode.window.registerWebviewViewProvider('happyReader.reader', readerViewProvider, {
			webviewOptions: {
				retainContextWhenHidden: true
			}
		}),
		addBooksCommand,
		openBookCommand,
		refreshCommand,
		removeBookCommand
	);
}

export function deactivate() {}
