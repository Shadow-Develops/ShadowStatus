/**
 * Simple markdown parser for GitHub-style markdown with Tailwind/DaisyUI styling
 * Supports: headers, bold, italic, strikethrough, inline code, code blocks,
 * links, images, lists, blockquotes, and horizontal rules
 */

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

/**
 * Parse inline markdown elements (bold, italic, code, links, etc.)
 * @param {string} text
 * @returns {string}
 */
function parseInline(text) {
	// Inline code (must be first to prevent other parsing inside code)
	text = text.replace(
		/`([^`]+)`/g,
		'<code class="bg-base-300 text-base-content px-1.5 py-0.5 rounded text-sm font-mono">$1</code>'
	);

	// Images ![alt](url)
	text = text.replace(
		/!\[([^\]]*)\]\(([^)]+)\)/g,
		'<img src="$2" alt="$1" class="max-w-full h-auto rounded-lg my-2" />'
	);

	// Links [text](url)
	text = text.replace(
		/\[([^\]]+)\]\(([^)]+)\)/g,
		'<a href="$2" target="_blank" rel="noopener noreferrer" class="link link-primary">$1</a>'
	);

	// Bold **text** or __text__
	text = text.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>');
	text = text.replace(/__([^_]+)__/g, '<strong class="font-semibold">$1</strong>');

	// Italic *text* or _text_
	text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
	text = text.replace(/(?<![a-zA-Z0-9])_([^_]+)_(?![a-zA-Z0-9])/g, '<em>$1</em>');

	// Strikethrough ~~text~~
	text = text.replace(/~~([^~]+)~~/g, '<del class="opacity-60">$1</del>');

	// Auto-link URLs
	text = text.replace(
		/(?<!href="|src=")(https?:\/\/[^\s<]+[^\s<.,;:!?"'\])>])/g,
		'<a href="$1" target="_blank" rel="noopener noreferrer" class="link link-primary">$1</a>'
	);

	return text;
}

/**
 * Parse markdown text to HTML
 * @param {string} markdown
 * @returns {string}
 */
export function parseMarkdown(markdown) {
	if (!markdown) return '';

	const lines = markdown.split('\n');
	const result = [];
	let inCodeBlock = false;
	let codeBlockContent = [];
	let codeBlockLang = '';
	let inList = false;
	let listType = '';
	let inBlockquote = false;
	let blockquoteContent = [];

	for (let i = 0; i < lines.length; i++) {
		let line = lines[i];

		// Code blocks ```
		if (line.trim().startsWith('```')) {
			if (!inCodeBlock) {
				inCodeBlock = true;
				codeBlockLang = line.trim().slice(3).trim();
				codeBlockContent = [];
			} else {
				inCodeBlock = false;
				const langAttr = codeBlockLang ? ` data-lang="${escapeHtml(codeBlockLang)}"` : '';
				result.push(
					`<pre class="bg-base-300 rounded-lg p-4 overflow-x-auto my-2"${langAttr}><code class="text-sm font-mono text-base-content">${escapeHtml(codeBlockContent.join('\n'))}</code></pre>`
				);
				codeBlockContent = [];
				codeBlockLang = '';
			}
			continue;
		}

		if (inCodeBlock) {
			codeBlockContent.push(line);
			continue;
		}

		// Close blockquote if line doesn't start with >
		if (inBlockquote && !line.trim().startsWith('>')) {
			result.push(
				`<blockquote class="border-l-4 border-primary pl-4 my-2 italic text-base-content/80">${parseMarkdown(blockquoteContent.join('\n'))}</blockquote>`
			);
			blockquoteContent = [];
			inBlockquote = false;
		}

		// Close list if line is empty or doesn't continue list
		if (inList && line.trim() === '') {
			result.push(listType === 'ul' ? '</ul>' : '</ol>');
			inList = false;
			listType = '';
			result.push('');
			continue;
		}

		// Blockquotes
		if (line.trim().startsWith('>')) {
			inBlockquote = true;
			blockquoteContent.push(line.trim().slice(1).trim());
			continue;
		}

		// Horizontal rule
		if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
			if (inList) {
				result.push(listType === 'ul' ? '</ul>' : '</ol>');
				inList = false;
				listType = '';
			}
			result.push('<hr class="divider my-4" />');
			continue;
		}

		// Headers
		const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
		if (headerMatch) {
			if (inList) {
				result.push(listType === 'ul' ? '</ul>' : '</ol>');
				inList = false;
				listType = '';
			}
			const level = headerMatch[1].length;
			const content = parseInline(escapeHtml(headerMatch[2]));
			const headerClasses = {
				1: 'text-2xl font-bold mt-4 mb-2',
				2: 'text-xl font-bold mt-3 mb-2',
				3: 'text-lg font-semibold mt-3 mb-1',
				4: 'text-base font-semibold mt-2 mb-1',
				5: 'text-sm font-semibold mt-2 mb-1',
				6: 'text-sm font-medium mt-2 mb-1'
			};
			result.push(`<h${level} class="${headerClasses[level]}">${content}</h${level}>`);
			continue;
		}

		// Unordered list
		const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
		if (ulMatch) {
			if (!inList || listType !== 'ul') {
				if (inList) result.push(listType === 'ul' ? '</ul>' : '</ol>');
				result.push('<ul class="list-disc list-inside my-2 space-y-1">');
				inList = true;
				listType = 'ul';
			}
			result.push(`<li>${parseInline(escapeHtml(ulMatch[2]))}</li>`);
			continue;
		}

		// Ordered list
		const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
		if (olMatch) {
			if (!inList || listType !== 'ol') {
				if (inList) result.push(listType === 'ul' ? '</ul>' : '</ol>');
				result.push('<ol class="list-decimal list-inside my-2 space-y-1">');
				inList = true;
				listType = 'ol';
			}
			result.push(`<li>${parseInline(escapeHtml(olMatch[2]))}</li>`);
			continue;
		}

		// Close list if we got here and were in a list
		if (inList && line.trim() !== '') {
			result.push(listType === 'ul' ? '</ul>' : '</ol>');
			inList = false;
			listType = '';
		}

		// Empty line
		if (line.trim() === '') {
			result.push('');
			continue;
		}

		// Regular paragraph
		result.push(`<p class="my-1">${parseInline(escapeHtml(line))}</p>`);
	}

	// Close any open elements
	if (inCodeBlock) {
		const langAttr = codeBlockLang ? ` data-lang="${escapeHtml(codeBlockLang)}"` : '';
		result.push(
			`<pre class="bg-base-300 rounded-lg p-4 overflow-x-auto my-2"${langAttr}><code class="text-sm font-mono text-base-content">${escapeHtml(codeBlockContent.join('\n'))}</code></pre>`
		);
	}
	if (inList) {
		result.push(listType === 'ul' ? '</ul>' : '</ol>');
	}
	if (inBlockquote) {
		result.push(
			`<blockquote class="border-l-4 border-primary pl-4 my-2 italic text-base-content/80">${parseMarkdown(blockquoteContent.join('\n'))}</blockquote>`
		);
	}

	return result.join('\n');
}

export default parseMarkdown;
