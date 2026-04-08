/**
 * Lightweight incident updater for GitHub Actions
 * Triggered by GitHub Issues events: updates only the incidents and announcements
 * fields in static/data/status.json without running monitor checks.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const __baseDir = resolve(__dirname, '..');
const configPath = resolve(__baseDir, 'config.json');
const statusPath = resolve(__baseDir, 'static', 'data', 'status.json');

const GITHUB_API = 'https://api.github.com';

//? ---------------------------------------------------------------------------
//? GitHub API helpers
//? ---------------------------------------------------------------------------

async function fetchIssuesWithLabel(owner, repo, label, state = 'all') {
	const token = process.env.GIT_TOKEN || null;
	const allIssues = [];
	let page = 1;
	const perPage = 100;

	while (true) {
		const url = new URL(`${GITHUB_API}/repos/${owner}/${repo}/issues`);
		url.searchParams.set('state', state);
		url.searchParams.set('labels', label);
		url.searchParams.set('per_page', String(perPage));
		url.searchParams.set('page', String(page));
		url.searchParams.set('sort', 'updated');
		url.searchParams.set('direction', 'desc');

		const headers = { Accept: 'application/vnd.github.v3+json' };
		if (token) {
			headers.Authorization = `token ${token}`;
		}

		try {
			const response = await fetch(url.toString(), { headers });
			if (!response.ok) {
				console.warn(`Failed to fetch GitHub issues for label "${label}": ${response.status}`);
				return allIssues;
			}
			const issues = await response.json();
			allIssues.push(...issues);

			if (issues.length < perPage) {
				break;
			}
			page++;
		} catch (e) {
			console.warn(`Error fetching GitHub issues for label "${label}":`, e.message);
			return allIssues;
		}
	}

	return allIssues;
}

async function fetchCommentsForIssues(owner, repo, issueNumbers) {
	const token = process.env.GIT_TOKEN || null;
	const headers = { Accept: 'application/vnd.github.v3+json' };

	if (token) {
		headers.Authorization = `token ${token}`;
	}

	const commentPromises = issueNumbers.map(async (issueNumber) => {
		try {
			const response = await fetch(
				`${GITHUB_API}/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
				{ headers }
			);

			if (!response.ok) {
				console.warn(`Failed to fetch comments for issue #${issueNumber}: ${response.status}`);
				return [issueNumber, []];
			}

			const comments = await response.json();
			return [issueNumber, comments];
		} catch (e) {
			console.warn(`Error fetching comments for issue #${issueNumber}:`, e.message);
			return [issueNumber, []];
		}
	});

	const results = await Promise.all(commentPromises);
	return new Map(results);
}

//? ---------------------------------------------------------------------------
//? Issue transformation helpers
//? ---------------------------------------------------------------------------

function parseMonitorsFromBody(body) {
	const monitors = [];
	const groups = [];

	if (!body) return { monitors, groups };

	const monitorsMatch = body.match(/<!--\s*monitors:\s*([^>]+?)-->/i);
	if (monitorsMatch) {
		monitors.push(
			...monitorsMatch[1]
				.split(',')
				.map((m) => m.trim())
				.filter((m) => m.length > 0)
		);
	}

	const groupsMatch = body.match(/<!--\s*groups:\s*([^>]+?)-->/i);
	if (groupsMatch) {
		groups.push(
			...groupsMatch[1]
				.split(',')
				.map((g) => g.trim())
				.filter((g) => g.length > 0)
		);
	}

	return { monitors, groups };
}

function parseDateString(dateStr) {
	if (!dateStr) return null;

	const str = dateStr.trim();

	const isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{1,2}):(\d{2})$/);
	if (isoMatch) {
		const [, date, hours, minutes] = isoMatch;
		const parsed = new Date(`${date}T${hours.padStart(2, '0')}:${minutes}:00`);
		if (!isNaN(parsed.getTime())) return parsed;
	}

	const twelveHourMatch = str.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
	if (twelveHourMatch) {
		const [, date, hours, minutes, meridiem] = twelveHourMatch;
		let hour = parseInt(hours, 10);
		if (meridiem.toUpperCase() === 'PM' && hour !== 12) {
			hour += 12;
		} else if (meridiem.toUpperCase() === 'AM' && hour === 12) {
			hour = 0;
		}
		const parsed = new Date(`${date}T${hour.toString().padStart(2, '0')}:${minutes}:00`);
		if (!isNaN(parsed.getTime())) return parsed;
	}

	const dateOnlyMatch = str.match(/^(\d{4}-\d{2}-\d{2})$/);
	if (dateOnlyMatch) {
		const parsed = new Date(`${dateOnlyMatch[1]}T00:00:00`);
		if (!isNaN(parsed.getTime())) return parsed;
	}

	const parsed = new Date(str);
	if (!isNaN(parsed.getTime())) return parsed;

	return null;
}

function parseMaintenanceSchedule(body) {
	let start = null;
	let end = null;

	if (!body) return { start, end };

	const startMatch = body.match(/<!--\s*start:\s*([^>]+?)-->/i);
	if (startMatch) {
		start = parseDateString(startMatch[1]);
	}

	const endMatch = body.match(/<!--\s*end:\s*([^>]+?)-->/i);
	if (endMatch) {
		end = parseDateString(endMatch[1]);
	}

	return { start, end };
}

function getMaintenanceState(schedule, isClosed) {
	if (isClosed) {
		return 'ended';
	}

	const now = new Date();
	const { start, end } = schedule;

	if (end && now > end) {
		return 'ended';
	}

	if (start && now < start) {
		return 'upcoming';
	}

	return 'active';
}

function parseIssueLabels(labels, config) {
	const statusLevels = Object.keys(config.statusLevels);
	const statusLabel = labels.find((l) => statusLevels.includes(l.name.toLowerCase()));
	const status = statusLabel ? statusLabel.name.toLowerCase() : 'major';
	const isMaintenance = labels.some((l) => l.name.toLowerCase() === config.github.maintenanceLabel);
	return { status, isMaintenance };
}

function transformIssues(issues, config, commentsMap) {
	return issues.map((issue) => {
		const { status, isMaintenance } = parseIssueLabels(issue.labels, config);
		const { monitors, groups } = parseMonitorsFromBody(issue.body);
		const schedule = parseMaintenanceSchedule(issue.body);
		const maintenanceState = getMaintenanceState(schedule, issue.state === 'closed');
		const rawComments = commentsMap?.get(issue.number) ?? [];

		const updates = Array.isArray(rawComments)
			? rawComments.map((comment) => ({
					id: comment.id,
					body: comment.body,
					createdAt: comment.created_at,
					updatedAt: comment.updated_at,
					author: comment.user?.login ?? 'Unknown',
					authorAvatar: comment.user?.avatar_url ?? null
				}))
			: [];

		return {
			id: issue.number,
			title: issue.title,
			body: issue.body,
			status: isMaintenance ? 'maintenance' : status,
			monitors,
			groups,
			isMaintenance,
			isResolved: issue.state === 'closed' || maintenanceState === 'ended',
			isUpcoming: maintenanceState === 'upcoming',
			scheduledStart: schedule.start?.toISOString() ?? null,
			scheduledEnd: schedule.end?.toISOString() ?? null,
			createdAt: issue.created_at,
			updatedAt: issue.updated_at,
			closedAt: issue.closed_at,
			url: issue.html_url,
			updates
		};
	});
}

//? ---------------------------------------------------------------------------
//? Main
//? ---------------------------------------------------------------------------

async function main() {
	const config = JSON.parse(readFileSync(configPath, 'utf-8'));

	const hasGitHubConfig =
		config.github?.owner &&
		config.github?.repo &&
		config.github.owner !== 'YOUR_USERNAME' &&
		config.github.repo !== 'YOUR_REPO';

	if (!hasGitHubConfig) {
		console.log('GitHub config not set, nothing to do.');
		return;
	}

	if (!existsSync(statusPath)) {
		console.warn('status.json not found, skipping update.');
		return;
	}

	const { owner, repo } = config.github;

	console.log('Fetching incidents and announcements from GitHub...');

	const [incidentIssues, maintenanceIssues, announcementIssues] = await Promise.all([
		fetchIssuesWithLabel(owner, repo, config.github.issuesLabel),
		fetchIssuesWithLabel(owner, repo, config.github.maintenanceLabel),
		fetchIssuesWithLabel(owner, repo, config.github.announcementLabel)
	]);

	const issueMap = new Map();
	for (const issue of [...incidentIssues, ...maintenanceIssues]) {
		issueMap.set(issue.number, issue);
	}
	const issues = Array.from(issueMap.values());

	console.log(`  Found ${issues.length} incident/maintenance issue(s)`);

	const issueNumbers = issues.map((i) => i.number);
	const commentsMap = await fetchCommentsForIssues(owner, repo, issueNumbers);
	const incidents = transformIssues(issues, config, commentsMap);

	const filteredAnnounce = announcementIssues.filter((i) => i.state === 'open');
	const announceNumbers = filteredAnnounce.map((i) => i.number);
	const announceCommentsMap = await fetchCommentsForIssues(owner, repo, announceNumbers);
	const announcements = transformIssues(filteredAnnounce, config, announceCommentsMap);

	console.log(`  Found ${announcements.length} announcement(s)`);

	const status = JSON.parse(readFileSync(statusPath, 'utf-8'));
	status.incidents = incidents;
	status.announcements = announcements;

	writeFileSync(statusPath, JSON.stringify(status, null, 2));
	console.log('status.json updated with latest incidents and announcements.');
}

main().catch((e) => {
	console.error('update-incidents failed:', e);
	process.exit(1);
});
