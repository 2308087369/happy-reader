export interface TxtChapter {
	title: string;
	content: string;
	lineStart: number;
}

const CHAPTER_REGEX = /^第[\u4e00-\u9fa5a-zA-Z0-9]{1,9}[章节卷集部篇回].*$/;

export function parseTxtChapters(source: string): TxtChapter[] {
	const lines = source.replace(/\r\n/g, '\n').split('\n');
	const chapters: TxtChapter[] = [];
	let currentTitle = '开始';
	let currentContent: string[] = [];
	let currentLineStart = 1;

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index].trim();
		const rawLine = lines[index];

		if (CHAPTER_REGEX.test(line)) {
			if (currentContent.length > 0) {
				chapters.push({
					title: currentTitle,
					content: currentContent.join('\n').trim(),
					lineStart: currentLineStart
				});
			}
			currentTitle = line;
			currentContent = [];
			currentLineStart = index + 1;
			continue;
		}

		currentContent.push(rawLine);
	}

	if (currentContent.length > 0) {
		chapters.push({
			title: currentTitle,
			content: currentContent.join('\n').trim(),
			lineStart: currentLineStart
		});
	}

	if (chapters.length === 0) {
		return [
			{
				title: '开始',
				content: source.trim(),
				lineStart: 1
			}
		];
	}

	return chapters.map((chapter) => ({
		...chapter,
		content: chapter.content.length > 0 ? chapter.content : '本章内容为空'
	}));
}
