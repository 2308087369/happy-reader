import * as vscode from 'vscode';
import { BookItem, BookStore } from '../library/bookStore';

export class BookTreeItem extends vscode.TreeItem {
	readonly book: BookItem;

	constructor(book: BookItem) {
		super(book.title, vscode.TreeItemCollapsibleState.None);
		this.book = book;
		this.id = book.id;
		this.description = `${Math.round(book.reading.progress * 100)}%`;
		this.tooltip = `${book.title}\n${book.filePath}`;
		this.contextValue = 'happyReader.book';
		this.iconPath = new vscode.ThemeIcon('book');
		this.command = {
			command: 'happy-reader.openBook',
			title: '打开书籍',
			arguments: [book]
		};
	}
}

export class BookShelfProvider implements vscode.TreeDataProvider<BookTreeItem> {
	private readonly store: BookStore;
	private readonly emitter = new vscode.EventEmitter<BookTreeItem | undefined | void>();
	readonly onDidChangeTreeData = this.emitter.event;

	constructor(store: BookStore) {
		this.store = store;
	}

	refresh(): void {
		this.emitter.fire();
	}

	getTreeItem(element: BookTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(): BookTreeItem[] {
		return this.store.getBooks().map((book) => new BookTreeItem(book));
	}
}
