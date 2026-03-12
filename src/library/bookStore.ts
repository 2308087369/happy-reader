import * as path from 'path';
import * as vscode from 'vscode';

export interface BookReadingState {
	currentChapter: number;
	progress: number;
	fontSize: number;
	lineHeight: number;
	theme: 'paper' | 'dark';
}

export interface BookItem {
	id: string;
	title: string;
	filePath: string;
	addedAt: number;
	lastOpenedAt: number;
	reading: BookReadingState;
}

const BOOKS_KEY = 'happy-reader.books';

export class BookStore {
	private readonly context: vscode.ExtensionContext;

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
	}

	getBooks(): BookItem[] {
		const books = this.context.globalState.get<BookItem[]>(BOOKS_KEY, []);
		return books.slice().sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
	}

	getBookById(id: string): BookItem | undefined {
		return this.getBooks().find((book) => book.id === id);
	}

	async upsertBooks(filePaths: string[]): Promise<number> {
		const now = Date.now();
		const map = new Map(this.getBooks().map((book) => [book.id, book]));
		let addedCount = 0;

		for (const filePath of filePaths) {
			const normalizedPath = path.normalize(filePath);
			const id = normalizedPath.toLowerCase();
			const existing = map.get(id);
			if (existing) {
				map.set(id, {
					...existing,
					filePath: normalizedPath
				});
				continue;
			}

			addedCount += 1;
			map.set(id, {
				id,
				title: path.basename(normalizedPath, path.extname(normalizedPath)),
				filePath: normalizedPath,
				addedAt: now,
				lastOpenedAt: now,
				reading: {
					currentChapter: 0,
					progress: 0,
					fontSize: 18,
					lineHeight: 1.8,
					theme: 'paper'
				}
			});
		}

		await this.saveBooks([...map.values()]);
		return addedCount;
	}

	async markOpened(id: string): Promise<void> {
		const books = this.getBooks().map((book) =>
			book.id === id
				? {
					...book,
					lastOpenedAt: Date.now()
				}
				: book
		);
		await this.saveBooks(books);
	}

	async updateReading(id: string, readingPatch: Partial<BookReadingState>): Promise<void> {
		const books = this.getBooks().map((book) =>
			book.id === id
				? {
					...book,
					reading: {
						...book.reading,
						...readingPatch
					}
				}
				: book
		);
		await this.saveBooks(books);
	}

	async removeBook(id: string): Promise<void> {
		const books = this.getBooks().filter((book) => book.id !== id);
		await this.saveBooks(books);
	}

	private async saveBooks(books: BookItem[]): Promise<void> {
		await this.context.globalState.update(BOOKS_KEY, books);
	}
}
