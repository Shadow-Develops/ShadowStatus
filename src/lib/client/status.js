/**
 * Status utility functions
 */

/**
 * Format a date as relative time (e.g., "5 minutes ago")
 * @param {string|Date} date - Date to format
 * @returns {string} Relative time string
 */
export function timeAgo(date) {
	const now = new Date();
	const then = new Date(date);
	const seconds = Math.floor((now - then) / 1000);

	const intervals = [
		{ label: 'year', seconds: 31536000 },
		{ label: 'month', seconds: 2592000 },
		{ label: 'day', seconds: 86400 },
		{ label: 'hour', seconds: 3600 },
		{ label: 'minute', seconds: 60 }
	];

	for (const interval of intervals) {
		const count = Math.floor(seconds / interval.seconds);
		if (count >= 1) {
			return `${count} ${interval.label}${count !== 1 ? 's' : ''} ago`;
		}
	}

	return 'just now';
}

/**
 * Format a date for display
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
	return new Date(date).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

/**
 * Get CSS classes for a status badge
 * @param {string} status - Status key
 * @param {Object} config - Site config with statusLevels
 * @returns {string} CSS classes
 */
export function getStatusClasses(status, config) {
	const color = config.statusLevels[status]?.color ?? 'neutral';
	return `badge-${color}`;
}

/**
 * Get the status icon SVG path
 * @param {string} status - Status key
 * @returns {string} SVG icon markup
 */
export function getStatusIcon(status) {
	const icons = {
		operational: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
		</svg>`,
		degraded: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
		</svg>`,
		partial: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
		</svg>`,
		major: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
		</svg>`,
		maintenance: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
		</svg>`
	};

	return icons[status] ?? icons.operational;
}

/**
 * Get background color class for status
 * @param {string} status - Status key
 * @returns {string} Tailwind background color class
 */
export function getStatusBgClass(status) {
	const colors = {
		operational: 'bg-success/10 border-success/20',
		degraded: 'bg-warning/10 border-warning/20',
		partial: 'bg-warning/10 border-warning/20',
		major: 'bg-error/10 border-error/20',
		maintenance: 'bg-info/10 border-info/20'
	};

	return colors[status] ?? colors.operational;
}

/**
 * Get text color class for status
 * @param {string} status - Status key
 * @returns {string} Tailwind text color class
 */
export function getStatusTextClass(status) {
	const colors = {
		operational: 'text-success',
		degraded: 'text-warning',
		partial: 'text-warning',
		major: 'text-error',
		maintenance: 'text-info'
	};

	return colors[status] ?? colors.operational;
}

/**
 * Get dot/indicator color class for status
 * @param {string} status - Status key
 * @returns {string} Tailwind background class for dot
 */
export function getStatusDotClass(status) {
	const colors = {
		operational: 'bg-success',
		degraded: 'bg-warning',
		partial: 'bg-warning',
		major: 'bg-error',
		maintenance: 'bg-info'
	};

	return colors[status] ?? colors.operational;
}
