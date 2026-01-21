/**
 * Standalone monitor check script for GitHub Actions
 * This script checks all monitors, fetches incidents, and generates status.json for the static site
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createConnection } from 'net';
import { promises as dns } from 'dns';
import dgram from 'dgram';

const execAsync = promisify(exec);

try {
	mkdirSync(resolve(__baseDir, 'data'), { recursive: true });
	mkdirSync(resolve(__baseDir, 'static', 'data'), { recursive: true });
} catch (e) {
	// Directories already exist
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const __baseDir = resolve(__dirname, '..');
const monitorsPath = resolve(__baseDir, 'monitors.json');
const configPath = resolve(__baseDir, 'config.json');
const historyPath = resolve(__baseDir, 'data', 'history.json');
const statusPath = resolve(__baseDir, 'static', 'data', 'status.json');
const notificationStatePath = resolve(__baseDir, 'data', 'notification-state.json');

const GITHUB_API = 'https://api.github.com';

//? ============================================================================
//? Notification State Management
//? ============================================================================

function loadNotificationState() {
	if (!existsSync(notificationStatePath)) {
		return {};
	}

	try {
		return JSON.parse(readFileSync(notificationStatePath, 'utf-8'));
	} catch (e) {
		console.warn('Failed to load notification-state.json:', e.message);
		return {};
	}
}

function saveNotificationState(state) {
	writeFileSync(notificationStatePath, JSON.stringify(state, null, 2));
}

//? ============================================================================
//? Notification Sending
//? ============================================================================

async function sendDiscordWebhook(webhookUrl, monitor, status, previousStatus, config) {
	if (!webhookUrl) {
		console.log('  Discord webhook URL not configured, skipping notification');
		return false;
	}

	const isDown = status !== 'operational';
	const statusInfo = config.statusLevels[status] || { label: status, color: 'warning' };

	const colorMap = {
		success: 0x22c55e, // green
		warning: 0xeab308, // yellow
		error: 0xef4444, // red
		info: 0x3b82f6 // blue
	};

	const embedColor = colorMap[statusInfo.color] || 0x6b7280;

	const embed = {
		title: isDown ? '🔴 Monitor Down' : '🟢 Monitor Recovered',
		description: isDown
			? `**${monitor.name}** is experiencing issues`
			: `**${monitor.name}** is back online`,
		color: embedColor,
		fields: [
			{
				name: 'Status',
				value: statusInfo.label,
				inline: true
			},
			{
				name: 'Previous Status',
				value: config.statusLevels[previousStatus]?.label || previousStatus,
				inline: true
			}
		],
		timestamp: new Date().toISOString(),
		footer: {
			text: config.siteSettings?.siteName || 'Status Monitor'
		}
	};

	if (monitor.target && monitor.showTarget !== false) {
		embed.fields.push({
			name: 'Target',
			value: monitor.target,
			inline: false
		});
	}

	if (monitor.message) {
		embed.fields.push({
			name: 'Details',
			value: monitor.message,
			inline: false
		});
	}

	let content;
	if (
		config.notifications.discord.defaultPingRole &&
		(config.notifications.discord.defaultPingRole !== '' ||
			config.notifications.discord.defaultPingRole !== null)
	) {
		if (config.notifications.discord.defaultPingRole == 'everyone') {
			content = '@everyone';
		} else if (config.notifications.discord.defaultPingRole == 'here') {
			content = '@here';
		} else {
			content = `<@&${config.notifications.discord.defaultPingRole}>`;
		}
	}
	if (
		monitor.discordPingRole &&
		(monitor.discordPingRole !== '' || monitor.discordPingRole !== null)
	) {
		if (monitor.discordPingRole == 'everyone') {
			content = '@everyone';
		} else if (monitor.discordPingRole == 'here') {
			content = '@here';
		} else {
			content = `<@&${monitor.discordPingRole}>`;
		}
	}
	if (!isDown) content = '';

	try {
		const response = await fetch(webhookUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ content, embeds: [embed] })
		});

		if (!response.ok) {
			console.warn(`  Discord webhook failed: ${response.status} ${response.statusText}`);
			return false;
		}

		console.log(`  Discord notification sent for ${monitor.name}`);
		return true;
	} catch (error) {
		console.warn(`  Discord webhook error: ${error.message}`);
		return false;
	}
}

async function sendGenericWebhook(webhookUrl, monitor, status, previousStatus, config) {
	if (!webhookUrl) {
		console.log('  Generic webhook URL not configured, skipping notification');
		return false;
	}

	const isDown = status !== 'operational';
	const statusInfo = config.statusLevels[status] || { label: status };

	const payload = {
		event: isDown ? 'monitor.down' : 'monitor.up',
		monitor: {
			name: monitor.name,
			type: monitor.type,
			target: monitor.target || null
		},
		status: {
			current: status,
			currentLabel: statusInfo.label,
			previous: previousStatus,
			previousLabel: config.statusLevels[previousStatus]?.label || previousStatus
		},
		message: monitor.message || null,
		responseTime: monitor.responseTime || null,
		timestamp: new Date().toISOString(),
		siteName: config.siteSettings?.siteName || 'Status Monitor'
	};

	try {
		const response = await fetch(webhookUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});

		if (!response.ok) {
			console.warn(`  Generic webhook failed: ${response.status} ${response.statusText}`);
			return false;
		}

		console.log(`  Generic webhook notification sent for ${monitor.name}`);
		return true;
	} catch (error) {
		console.warn(`  Generic webhook error: ${error.message}`);
		return false;
	}
}

async function sendNotifications(monitor, status, previousStatus, config) {
	const notifications = config.notifications || {};
	const discordUrl = process.env.DISCORD_WEBHOOK || null;
	const webhookUrl = process.env.WEBHOOK_URL || null;

	const promises = [];

	if (notifications.discord.enabled && discordUrl) {
		promises.push(sendDiscordWebhook(discordUrl, monitor, status, previousStatus, config));
	}

	if (notifications.webhook && webhookUrl) {
		promises.push(sendGenericWebhook(webhookUrl, monitor, status, previousStatus, config));
	}

	if (promises.length > 0) {
		await Promise.all(promises);
	}
}

function shouldNotify(monitor, currentStatus, notificationState, config) {
	const notifications = config.notifications || {};

	if (!notifications.discord && !notifications.webhook) {
		return { shouldSend: false, reason: 'notifications disabled' };
	}

	const monitorNotifyEnabled =
		monitor.notify !== undefined ? monitor.notify : notifications.defaultEnabled !== false;

	if (!monitorNotifyEnabled) {
		return { shouldSend: false, reason: 'monitor notifications disabled' };
	}

	const monitorState = notificationState[monitor.name] || {
		lastStatus: 'operational',
		consecutiveDownCount: 0,
		notifiedDown: false
	};

	const previousStatus = monitorState.lastStatus;
	const numberOfDown = notifications.numberOfDown || 1;

	if (currentStatus === 'maintenance' || previousStatus === 'maintenance') {
		return { shouldSend: false, reason: 'maintenance status ignored' };
	}

	const wasOperational = previousStatus === 'operational';
	const isOperational = currentStatus === 'operational';
	const wasDown = previousStatus !== 'operational';
	const isDown = currentStatus !== 'operational';

	// Case 1: Going from operational to down (degraded/partial/major)
	if (wasOperational && isDown) {
		const newConsecutiveCount = monitorState.consecutiveDownCount + 1;

		if (newConsecutiveCount >= numberOfDown) {
			return {
				shouldSend: true,
				reason: 'went down',
				previousStatus,
				markNotifiedDown: true
			};
		} else {
			return {
				shouldSend: false,
				reason: `down count ${newConsecutiveCount}/${numberOfDown}`,
				incrementDownCount: true
			};
		}
	}

	// Case 2: Still down but not yet notified - check if we've hit the threshold
	if (wasDown && isDown && !monitorState.notifiedDown) {
		const newConsecutiveCount = monitorState.consecutiveDownCount + 1;

		if (newConsecutiveCount >= numberOfDown) {
			return {
				shouldSend: true,
				reason: 'reached down threshold',
				previousStatus: 'operational', // Report as coming from operational
				markNotifiedDown: true
			};
		} else {
			return {
				shouldSend: false,
				reason: `down count ${newConsecutiveCount}/${numberOfDown}`,
				incrementDownCount: true
			};
		}
	}

	// Case 3: Going from down to operational (recovery)
	if (wasDown && isOperational && monitorState.notifiedDown) {
		return {
			shouldSend: true,
			reason: 'recovered',
			previousStatus,
			resetDownState: true
		};
	}

	// Case 4: Was down but recovered before notification threshold
	if (wasDown && isOperational && !monitorState.notifiedDown) {
		return {
			shouldSend: false,
			reason: 'recovered before threshold',
			resetDownState: true
		};
	}

	return { shouldSend: false, reason: 'no status change' };
}

function updateNotificationState(notificationState, monitorName, currentStatus, notifyResult) {
	if (!notificationState[monitorName]) {
		notificationState[monitorName] = {
			lastStatus: 'operational',
			consecutiveDownCount: 0,
			notifiedDown: false
		};
	}

	const state = notificationState[monitorName];

	if (notifyResult.markNotifiedDown) {
		state.notifiedDown = true;
		state.consecutiveDownCount = 0;
	} else if (notifyResult.resetDownState) {
		state.notifiedDown = false;
		state.consecutiveDownCount = 0;
	} else if (notifyResult.incrementDownCount) {
		state.consecutiveDownCount++;
	}

	if (currentStatus !== 'maintenance') {
		state.lastStatus = currentStatus;
	}
}

//? ============================================================================
//? History Management
//? ============================================================================

function loadHistory() {
	if (!existsSync(historyPath)) {
		return {};
	}

	try {
		return JSON.parse(readFileSync(historyPath, 'utf-8'));
	} catch (e) {
		console.warn('Failed to load history.json:', e.message);
		return {};
	}
}

function saveHistory(history) {
	writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

function getTodayStr() {
	return new Date().toISOString().split('T')[0];
}

function recordCheck(history, result, config) {
	const monitorName = result.name;
	const today = getTodayStr();

	if (!history[monitorName]) {
		history[monitorName] = { days: {} };
	}

	if (!history[monitorName].days[today]) {
		history[monitorName].days[today] = {
			checks: [],
			worstStatus: 'operational'
		};
	}

	const dayData = history[monitorName].days[today];
	const now = new Date();
	const effectiveStatus = result.status;

	if (dayData.checks.length > 0) {
		const lastCheck = dayData.checks[dayData.checks.length - 1];
		const lastCheckTime = new Date(lastCheck.timestamp);
		const hoursSinceLastCheck = (now - lastCheckTime) / (1000 * 60 * 60);

		if (lastCheck.status === effectiveStatus && hoursSinceLastCheck < 1) {
			return;
		}
	}

	dayData.checks.push({
		status: effectiveStatus,
		responseTime: result.responseTime ?? null,
		statusCode: result.statusCode ?? null,
		timestamp: now.toISOString(),
		incidentOverride: result.incidentOverride ?? false
	});

	const effectivePriority = config.statusLevels[effectiveStatus]?.priority ?? 0;
	const worstPriority = config.statusLevels[dayData.worstStatus]?.priority ?? 0;

	if (effectivePriority > worstPriority) {
		dayData.worstStatus = effectiveStatus;
	}
}

function cleanupOldHistory(history, days = 90) {
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - days);
	const cutoffStr = cutoffDate.toISOString().split('T')[0];

	for (const monitorName of Object.keys(history)) {
		const monitorHistory = history[monitorName];
		if (monitorHistory.days) {
			for (const day of Object.keys(monitorHistory.days)) {
				if (day < cutoffStr) {
					delete monitorHistory.days[day];
				}
			}
		}
	}
}

function getDailyHistory(history, monitorName, days = 90) {
	const monitorHistory = history[monitorName]?.days ?? {};
	const filledDays = [];
	const todayStr = getTodayStr();
	const today = new Date(todayStr + 'T00:00:00Z');

	for (let i = days - 1; i >= 0; i--) {
		const date = new Date(today);
		date.setUTCDate(date.getUTCDate() - i);
		const dateStr = date.toISOString().split('T')[0];

		const dayData = monitorHistory[dateStr];

		if (dayData && dayData.checks.length > 0) {
			const responseTimes = dayData.checks.map((c) => c.responseTime).filter((t) => t !== null);
			const avgResponseTime =
				responseTimes.length > 0
					? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
					: null;

			const statusCounts = {};
			for (const check of dayData.checks) {
				statusCounts[check.status] = (statusCounts[check.status] || 0) + 1;
			}

			filledDays.push({
				day: dateStr,
				status: dayData.worstStatus,
				checks: dayData.checks.length,
				avgResponseTime,
				statusCounts
			});
		} else {
			filledDays.push({
				day: dateStr,
				status: null,
				checks: 0,
				avgResponseTime: null
			});
		}
	}

	return filledDays;
}

function getUptimePercentage(history, monitorName, days = 90) {
	const monitorHistory = history[monitorName]?.days ?? {};

	let totalChecks = 0;
	let operationalChecks = 0;

	const todayStr = getTodayStr();
	const today = new Date(todayStr + 'T00:00:00Z');

	for (let i = days - 1; i >= 0; i--) {
		const date = new Date(today);
		date.setUTCDate(date.getUTCDate() - i);
		const dateStr = date.toISOString().split('T')[0];

		const dayData = monitorHistory[dateStr];
		if (dayData && dayData.checks.length > 0) {
			for (const check of dayData.checks) {
				totalChecks++;
				if (check.status === 'operational') {
					operationalChecks++;
				}
			}
		}
	}

	if (totalChecks === 0) {
		return null;
	}

	return Math.round((operationalChecks / totalChecks) * 10000) / 100;
}

function getGroupDailyHistory(history, monitorNames, days = 90, config) {
	const filledDays = [];
	const todayStr = getTodayStr();
	const today = new Date(todayStr + 'T00:00:00Z');

	for (let i = days - 1; i >= 0; i--) {
		const date = new Date(today);
		date.setUTCDate(date.getUTCDate() - i);
		const dateStr = date.toISOString().split('T')[0];

		let worstStatus = null;
		let worstPriority = -1;
		let totalChecks = 0;
		let totalResponseTime = 0;
		let responseTimeCount = 0;
		const statusCounts = {};

		for (const monitorName of monitorNames) {
			const dayData = history[monitorName]?.days?.[dateStr];
			if (dayData && dayData.checks.length > 0) {
				totalChecks += dayData.checks.length;

				const statusPriority = config.statusLevels[dayData.worstStatus]?.priority ?? 0;
				if (statusPriority > worstPriority) {
					worstPriority = statusPriority;
					worstStatus = dayData.worstStatus;
				}

				for (const check of dayData.checks) {
					if (check.responseTime !== null) {
						totalResponseTime += check.responseTime;
						responseTimeCount++;
					}
					statusCounts[check.status] = (statusCounts[check.status] || 0) + 1;
				}
			}
		}

		filledDays.push({
			day: dateStr,
			status: worstStatus,
			checks: totalChecks,
			avgResponseTime: responseTimeCount > 0 ? totalResponseTime / responseTimeCount : null,
			statusCounts: totalChecks > 0 ? statusCounts : undefined
		});
	}

	return filledDays;
}

function getGroupUptimePercentage(history, monitorNames, days = 90) {
	let totalChecks = 0;
	let operationalChecks = 0;

	const todayStr = getTodayStr();
	const today = new Date(todayStr + 'T00:00:00Z');

	for (let i = days - 1; i >= 0; i--) {
		const date = new Date(today);
		date.setUTCDate(date.getUTCDate() - i);
		const dateStr = date.toISOString().split('T')[0];

		for (const monitorName of monitorNames) {
			const dayData = history[monitorName]?.days?.[dateStr];
			if (dayData && dayData.checks.length > 0) {
				for (const check of dayData.checks) {
					totalChecks++;
					if (check.status === 'operational') {
						operationalChecks++;
					}
				}
			}
		}
	}

	if (totalChecks === 0) {
		return null;
	}

	return Math.round((operationalChecks / totalChecks) * 10000) / 100;
}

//? ============================================================================
//? Monitor Checking
//? ============================================================================

async function checkHttp(url, expectedStatus = 200, timeout = 10000) {
	const startTime = Date.now();
	const expectedStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		const response = await fetch(url, {
			method: 'HEAD',
			signal: controller.signal,
			redirect: 'follow'
		});

		clearTimeout(timeoutId);
		const responseTime = Date.now() - startTime;

		const isUp = expectedStatuses.includes(response.status);

		return {
			status: isUp ? 'operational' : 'down',
			statusCode: response.status,
			responseTime,
			message: isUp
				? `HTTP ${response.status}`
				: `Expected ${expectedStatuses.join('/')}, got ${response.status}`
		};
	} catch (error) {
		const responseTime = Date.now() - startTime;

		return {
			status: 'down',
			statusCode: null,
			responseTime,
			message: error.name === 'AbortError' ? 'Timeout' : error.message
		};
	}
}

function isValidTarget(target) {
	if (!target || typeof target !== 'string') {
		return false;
	}

	const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
	if (ipv4Regex.test(target)) {
		const parts = target.split('.').map(Number);
		return parts.every((p) => p >= 0 && p <= 255);
	}

	const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
	if (ipv6Regex.test(target)) {
		return true;
	}

	const hostnameRegex =
		/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
	if (hostnameRegex.test(target) && target.length <= 253) {
		return true;
	}

	return false;
}

async function checkPing(target, timeout = 10) {
	const startTime = Date.now();

	if (!isValidTarget(target)) {
		return {
			status: 'down',
			responseTime: 0,
			message: 'Invalid target format'
		};
	}

	const isWindows = process.platform === 'win32';

	const command = isWindows
		? `ping -n 1 -w ${timeout * 1000} ${target}`
		: `ping -c 1 -W ${timeout} ${target}`;

	try {
		const { stdout } = await execAsync(command, { timeout: (timeout + 2) * 1000 });
		const responseTime = Date.now() - startTime;

		// Debug logging for ping output
		console.log(`  [PING DEBUG] Target: ${target}`);
		console.log(`  [PING DEBUG] Command: ${command}`);
		console.log(`  [PING DEBUG] Raw stdout:\n${stdout}`);
		console.log(`  [PING DEBUG] Elapsed time: ${responseTime}ms`);

		const lossMatch = stdout.match(/(\d+)%\s*(?:packet\s*)?loss/i);
		const packetLoss = lossMatch ? parseInt(lossMatch[1], 10) : null;
		console.log(`  [PING DEBUG] Packet loss: ${packetLoss}%`);

		if (packetLoss === 100) {
			return {
				status: 'down',
				responseTime,
				message: 'Host unreachable (100% packet loss)'
			};
		}

		let pingTime = null;
		let matchedPattern = null;
		const patterns = [
			/time[=<](\d+\.?\d*)\s*ms/i, // Most common: time=15ms, time=15.3 ms, time<1ms
			/time[=<]\s*(\d+\.?\d*)\s*ms/i, // With space after =: time= 15 ms
			/rtt\s+min\/avg\/max\/\S+\s*=\s*[\d.]+\/([\d.]+)/i, // Linux summary: rtt min/avg/max/mdev = 14.267/14.267/14.267/0.000 ms
			/(\d+\.?\d*)\s*ms\s*$/im // Fallback: just "15.3 ms" at end of line
		];
		for (let i = 0; i < patterns.length; i++) {
			const match = stdout.match(patterns[i]);
			if (match) {
				pingTime = parseFloat(match[1]);
				matchedPattern = i;
				console.log(`  [PING DEBUG] Matched pattern ${i}: ${patterns[i]}`);
				console.log(`  [PING DEBUG] Extracted ping time: ${pingTime}ms`);
				break;
			}
		}

		if (pingTime === null) {
			console.log(`  [PING DEBUG] No pattern matched! Using fallback.`);
		}

		const finalResponseTime = pingTime ?? Math.min(responseTime, timeout * 1000);
		console.log(`  [PING DEBUG] Final response time: ${finalResponseTime}ms`);

		return {
			status: 'operational',
			responseTime: finalResponseTime,
			message: `Ping OK (${finalResponseTime}ms)`
		};
	} catch (error) {
		const responseTime = Date.now() - startTime;

		// Debug logging for ping errors
		console.log(`  [PING DEBUG] Target: ${target}`);
		console.log(`  [PING DEBUG] Command: ${command}`);
		console.log(`  [PING DEBUG] ERROR: ${error.message}`);
		console.log(`  [PING DEBUG] Error code: ${error.code}`);
		console.log(`  [PING DEBUG] Stderr: ${error.stderr}`);
		console.log(`  [PING DEBUG] Stdout: ${error.stdout}`);
		console.log(`  [PING DEBUG] Elapsed time: ${responseTime}ms`);

		return {
			status: 'down',
			responseTime,
			message: 'Host unreachable'
		};
	}
}

async function checkTcp(host, port, timeout = 5000) {
	const startTime = Date.now();

	if (!isValidTarget(host)) {
		return {
			status: 'down',
			responseTime: 0,
			message: 'Invalid host format'
		};
	}

	return new Promise((resolve) => {
		const socket = createConnection({ host, port, timeout });

		socket.on('connect', () => {
			const responseTime = Date.now() - startTime;
			socket.destroy();
			resolve({
				status: 'operational',
				responseTime,
				message: `TCP port ${port} open (${responseTime}ms)`
			});
		});

		socket.on('timeout', () => {
			const responseTime = Date.now() - startTime;
			socket.destroy();
			resolve({
				status: 'down',
				responseTime,
				message: `Connection timeout after ${timeout}ms`
			});
		});

		socket.on('error', (error) => {
			const responseTime = Date.now() - startTime;
			socket.destroy();
			resolve({
				status: 'down',
				responseTime,
				message: error.code === 'ECONNREFUSED' ? 'Connection refused' : error.message
			});
		});
	});
}

async function checkDns(domain, expectedIp = null, recordType = 'A', timeout = 5000) {
	const startTime = Date.now();

	if (!domain || typeof domain !== 'string') {
		return {
			status: 'down',
			responseTime: 0,
			message: 'Invalid domain'
		};
	}

	try {
		const timeoutPromise = new Promise((_, reject) =>
			setTimeout(() => reject(new Error('DNS lookup timeout')), timeout)
		);

		let result;
		const lookupPromise = (async () => {
			switch (recordType.toUpperCase()) {
				case 'A':
					return await dns.resolve4(domain);
				case 'AAAA':
					return await dns.resolve6(domain);
				case 'MX':
					return await dns.resolveMx(domain);
				case 'TXT':
					return await dns.resolveTxt(domain);
				case 'CNAME':
					return await dns.resolveCname(domain);
				case 'NS':
					return await dns.resolveNs(domain);
				default:
					return await dns.resolve4(domain);
			}
		})();

		result = await Promise.race([lookupPromise, timeoutPromise]);
		const responseTime = Date.now() - startTime;

		const resolvedValue = Array.isArray(result) ? result[0] : result;
		const resolvedDisplay =
			typeof resolvedValue === 'object' ? JSON.stringify(resolvedValue) : resolvedValue;

		if (expectedIp) {
			const matches = Array.isArray(result) ? result.includes(expectedIp) : result === expectedIp;
			return {
				status: matches ? 'operational' : 'down',
				responseTime,
				message: matches
					? `Resolved to ${resolvedDisplay} (${responseTime}ms)`
					: `Expected ${expectedIp}, got ${resolvedDisplay}`
			};
		}

		return {
			status: 'operational',
			responseTime,
			message: `Resolved to ${resolvedDisplay} (${responseTime}ms)`
		};
	} catch (error) {
		const responseTime = Date.now() - startTime;
		return {
			status: 'down',
			responseTime,
			message: error.code === 'ENOTFOUND' ? 'Domain not found' : error.message
		};
	}
}

async function checkStatuspage(url, timeout = 10000) {
	const startTime = Date.now();

	let apiUrl = url;
	if (!url.includes('/api/')) {
		apiUrl = url.replace(/\/$/, '') + '/api/v2/status.json';
	}

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		const response = await fetch(apiUrl, {
			signal: controller.signal,
			headers: { Accept: 'application/json' }
		});

		clearTimeout(timeoutId);
		const responseTime = Date.now() - startTime;

		if (!response.ok) {
			return {
				status: 'down',
				responseTime,
				statusCode: response.status,
				message: `HTTP ${response.status}`
			};
		}

		const data = await response.json();
		const indicator = data.status?.indicator?.toLowerCase() ?? 'unknown';
		const description = data.status?.description ?? 'Unknown status';

		const statusMap = {
			none: 'operational',
			minor: 'degraded',
			major: 'major',
			critical: 'major'
		};

		return {
			status: statusMap[indicator] ?? 'down',
			responseTime,
			statusCode: response.status,
			message: description
		};
	} catch (error) {
		const responseTime = Date.now() - startTime;
		return {
			status: 'down',
			responseTime,
			message: error.name === 'AbortError' ? 'Timeout' : error.message
		};
	}
}

async function checkJson(url, jsonPath, expectedValue, timeout = 10000) {
	const startTime = Date.now();

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		const response = await fetch(url, {
			signal: controller.signal,
			headers: { Accept: 'application/json' }
		});

		clearTimeout(timeoutId);
		const responseTime = Date.now() - startTime;

		if (!response.ok) {
			return {
				status: 'down',
				responseTime,
				statusCode: response.status,
				message: `HTTP ${response.status}`
			};
		}

		const data = await response.json();

		const pathParts = jsonPath.split('.');
		let value = data;
		for (const part of pathParts) {
			if (value === null || value === undefined) {
				return {
					status: 'down',
					responseTime,
					statusCode: response.status,
					message: `Path "${jsonPath}" not found`
				};
			}
			value = value[part];
		}

		const matches =
			expectedValue === undefined || expectedValue === null
				? value !== undefined && value !== null
				: String(value).toLowerCase() === String(expectedValue).toLowerCase();

		return {
			status: matches ? 'operational' : 'down',
			responseTime,
			statusCode: response.status,
			message: matches ? `${jsonPath} = ${value}` : `Expected ${expectedValue}, got ${value}`
		};
	} catch (error) {
		const responseTime = Date.now() - startTime;
		return {
			status: 'down',
			responseTime,
			message: error.name === 'AbortError' ? 'Timeout' : error.message
		};
	}
}

async function checkSteam(host, port = 27015, timeout = 5000) {
	const startTime = Date.now();

	if (!isValidTarget(host)) {
		return {
			status: 'down',
			responseTime: 0,
			message: 'Invalid host format'
		};
	}

	return new Promise((resolve) => {
		const socket = dgram.createSocket('udp4');
		let resolved = false;

		const timeoutHandle = setTimeout(() => {
			if (!resolved) {
				resolved = true;
				socket.close();
				resolve({
					status: 'down',
					responseTime: Date.now() - startTime,
					message: 'Server timeout'
				});
			}
		}, timeout);

		// A2S_INFO query packet
		// Header: 0xFFFFFFFF + 'T' (0x54) + "Source Engine Query\0"
		const query = Buffer.from([
			0xff, 0xff, 0xff, 0xff, 0x54, 0x53, 0x6f, 0x75, 0x72, 0x63, 0x65, 0x20, 0x45, 0x6e, 0x67,
			0x69, 0x6e, 0x65, 0x20, 0x51, 0x75, 0x65, 0x72, 0x79, 0x00
		]);

		socket.on('message', (msg) => {
			if (resolved) return;
			resolved = true;
			clearTimeout(timeoutHandle);
			const responseTime = Date.now() - startTime;

			try {
				if (msg[4] === 0x41) {
					// Challenge response - need to resend with challenge
					const challenge = msg.slice(5, 9);
					const challengeQuery = Buffer.concat([query, challenge]);
					socket.send(challengeQuery, port, host);
					resolved = false;
					return;
				}

				if (msg[4] === 0x49) {
					// Parse A2S_INFO response
					let offset = 6;
					const readString = () => {
						const end = msg.indexOf(0, offset);
						const str = msg.slice(offset, end).toString('utf8');
						offset = end + 1;
						return str;
					};

					const serverName = readString();
					const map = readString();
					readString(); // folder
					readString(); // game
					offset += 2; // steam app id
					const players = msg[offset];
					const maxPlayers = msg[offset + 1];

					socket.close();
					resolve({
						status: 'operational',
						responseTime,
						message: `${serverName} - ${players}/${maxPlayers} players on ${map}`,
						extra: { serverName, map, players, maxPlayers }
					});
				} else {
					socket.close();
					resolve({
						status: 'operational',
						responseTime,
						message: 'Server online'
					});
				}
			} catch (e) {
				socket.close();
				resolve({
					status: 'operational',
					responseTime,
					message: 'Server online (parse error)'
				});
			}
		});

		socket.on('error', (error) => {
			if (!resolved) {
				resolved = true;
				clearTimeout(timeoutHandle);
				socket.close();
				resolve({
					status: 'down',
					responseTime: Date.now() - startTime,
					message: error.message
				});
			}
		});

		socket.send(query, port, host);
	});
}

async function checkMinecraft(host, port = 25565, timeout = 5000) {
	const startTime = Date.now();

	if (!isValidTarget(host)) {
		return {
			status: 'down',
			responseTime: 0,
			message: 'Invalid host format'
		};
	}

	return new Promise((resolve) => {
		const socket = createConnection({ host, port, timeout });
		let resolved = false;
		let buffer = Buffer.alloc(0);

		const timeoutHandle = setTimeout(() => {
			if (!resolved) {
				resolved = true;
				socket.destroy();
				resolve({
					status: 'down',
					responseTime: Date.now() - startTime,
					message: 'Server timeout'
				});
			}
		}, timeout);

		socket.on('connect', () => {
			const hostBuffer = Buffer.from(host, 'utf8');
			const handshakeData = Buffer.concat([
				Buffer.from([0x00]), // Packet ID (handshake)
				Buffer.from([0xff, 0x05]), // Protocol version (varint: -1 / 765 for status)
				Buffer.from([hostBuffer.length]), // Host string length
				hostBuffer,
				Buffer.from([(port >> 8) & 0xff, port & 0xff]), // Port (big endian)
				Buffer.from([0x01]) // Next state: status
			]);

			const handshakePacket = Buffer.concat([Buffer.from([handshakeData.length]), handshakeData]);
			socket.write(handshakePacket);

			socket.write(Buffer.from([0x01, 0x00]));
		});

		socket.on('data', (data) => {
			buffer = Buffer.concat([buffer, data]);

			if (buffer.length > 5) {
				try {
					let offset = 0;
					while (buffer[offset] & 0x80) offset++;
					offset++; // Skip final byte of packet length
					offset++; // Skip packet ID

					let jsonLength = 0;
					let shift = 0;
					while (buffer[offset] & 0x80) {
						jsonLength |= (buffer[offset] & 0x7f) << shift;
						shift += 7;
						offset++;
					}
					jsonLength |= (buffer[offset] & 0x7f) << shift;
					offset++;

					if (buffer.length >= offset + jsonLength) {
						const jsonStr = buffer.slice(offset, offset + jsonLength).toString('utf8');
						const status = JSON.parse(jsonStr);

						if (!resolved) {
							resolved = true;
							clearTimeout(timeoutHandle);
							socket.destroy();

							const responseTime = Date.now() - startTime;
							const players = status.players?.online ?? 0;
							const maxPlayers = status.players?.max ?? 0;
							const version = status.version?.name ?? 'Unknown';
							let motd = 'Minecraft Server';

							if (status.description) {
								if (typeof status.description === 'string') {
									motd = status.description;
								} else if (status.description.text) {
									motd = status.description.text;
								} else if (status.description.extra) {
									motd = status.description.extra.map((e) => e.text || '').join('');
								}
							}

							motd = motd.replace(/§[0-9a-fk-or]/gi, '').trim();

							resolve({
								status: 'operational',
								responseTime,
								message: `${motd} - ${players}/${maxPlayers} (${version})`,
								extra: { motd, players, maxPlayers, version }
							});
						}
					}
				} catch (e) {
					// Not enough data yet or parse error, wait for more
				}
			}
		});

		socket.on('error', (error) => {
			if (!resolved) {
				resolved = true;
				clearTimeout(timeoutHandle);
				socket.destroy();
				resolve({
					status: 'down',
					responseTime: Date.now() - startTime,
					message: error.code === 'ECONNREFUSED' ? 'Server offline' : error.message
				});
			}
		});

		socket.on('timeout', () => {
			if (!resolved) {
				resolved = true;
				clearTimeout(timeoutHandle);
				socket.destroy();
				resolve({
					status: 'down',
					responseTime: Date.now() - startTime,
					message: 'Connection timeout'
				});
			}
		});
	});
}

function invertStatus(result) {
	const inverted = { ...result };
	if (result.status === 'operational') {
		inverted.status = 'down';
		inverted.message = `${result.message} (expected offline)`;
	} else {
		inverted.status = 'operational';
		inverted.message = `Offline as expected`;
	}
	return inverted;
}

function getRecentChecks(history, monitorName, count = 2) {
	const monitorHistory = history[monitorName]?.days ?? {};
	const allChecks = [];

	const todayStr = getTodayStr();
	const today = new Date(todayStr + 'T00:00:00Z');

	for (let i = 0; i < 7; i++) {
		const date = new Date(today);
		date.setUTCDate(date.getUTCDate() - i);
		const dateStr = date.toISOString().split('T')[0];

		const dayData = monitorHistory[dateStr];
		if (dayData && dayData.checks.length > 0) {
			allChecks.push(...dayData.checks);
		}
	}

	allChecks.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

	return allChecks.slice(0, count);
}

function determineStatus(history, currentStatus, monitorName, config) {
	if (currentStatus === 'operational') {
		return 'operational';
	}

	const majorThreshold = parseInt(config.majorOutageThreshold, 10) || 2;
	const recentChecks = getRecentChecks(history, monitorName, majorThreshold);

	let consecutiveFailures = 0;
	for (const check of recentChecks) {
		if (check.status !== 'operational') {
			consecutiveFailures++;
		} else {
			break;
		}
	}

	if (consecutiveFailures >= majorThreshold - 1) {
		return 'major';
	}

	return 'degraded';
}

async function checkMonitor(monitor, history, config, manualStatuses = {}) {
	let result;

	switch (monitor.type) {
		case 'http':
			result = await checkHttp(monitor.target, monitor.expectedStatus ?? 200);
			break;
		case 'ping':
			result = await checkPing(monitor.target, monitor.timeout);
			break;
		case 'tcp': {
			const [host, portStr] = (monitor.target ?? '').split(':');
			const port = parseInt(portStr, 10) || monitor.port || 80;
			result = await checkTcp(host, port);
			break;
		}
		case 'dns':
			result = await checkDns(
				monitor.target,
				monitor.expectedIp ?? null,
				monitor.recordType ?? 'A'
			);
			break;
		case 'statuspage':
			result = await checkStatuspage(monitor.target);
			break;
		case 'json':
			result = await checkJson(
				monitor.target,
				monitor.jsonPath ?? 'status',
				monitor.expectedValue ?? null
			);
			break;
		case 'steam': {
			const [steamHost, steamPortStr] = (monitor.target ?? '').split(':');
			const steamPort = parseInt(steamPortStr, 10) || monitor.port || 27015;
			result = await checkSteam(steamHost, steamPort);
			break;
		}
		case 'minecraft': {
			const [mcHost, mcPortStr] = (monitor.target ?? '').split(':');
			const mcPort = parseInt(mcPortStr, 10) || monitor.port || 25565;
			result = await checkMinecraft(mcHost, mcPort);
			break;
		}
		case 'manual': {
			const manualStatus = manualStatuses[monitor.name];
			if (manualStatus) {
				result = {
					status: manualStatus.status,
					message: manualStatus.message ?? 'Manual status',
					responseTime: null
				};
			} else {
				result = {
					status: 'operational',
					message: 'No status set',
					responseTime: null
				};
			}
			break;
		}
		default:
			result = {
				status: 'major',
				message: `Unknown monitor type: ${monitor.type}`
			};
	}

	if (monitor.inverse) {
		result = invertStatus(result);
	}

	if (result.status === 'down') {
		result.status = determineStatus(history, result.status, monitor.name, config);
	}

	return {
		name: monitor.name,
		...result
	};
}

//? ============================================================================
//? GitHub API
//? ============================================================================

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
	const token = process.env.GITHUB_TOKEN || null;
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

//? ============================================================================
//? Manual Monitor Status from GitHub Issues
//? ============================================================================

/**
 * Fetches manual monitor statuses from GitHub issues with the manualMonitorLabel.
 * Issue format:
 *   Title: Monitor Name
 *   Body: <!-- status: operational|degraded|major|down|maintenance -->
 *         Optional description text
 *   Labels: manualMonitorLabel + optionally a status label
 *
 * The status is determined by:
 * 1. Status comment in body (<!-- status: xxx -->)
 * 2. Status label on the issue (operational, degraded, major, maintenance)
 * 3. Defaults to 'operational' if issue is closed, 'major' if open with no status
 */
async function fetchManualMonitorStatuses(owner, repo, label, config) {
	const statuses = {};

	if (!label) return statuses;

	try {
		const issues = await fetchIssuesWithLabel(owner, repo, label, 'all');

		for (const issue of issues) {
			const monitorName = issue.title.trim();

			let status = null;
			let message = null;

			if (issue.body) {
				const statusMatch = issue.body.match(/<!--\s*status:\s*(\w+)\s*-->/i);
				if (statusMatch) {
					status = statusMatch[1].toLowerCase();
				}

				// Extract message (body without HTML comments)
				message = issue.body
					.replace(/<!--[\s\S]*?-->/g, '')
					.trim()
					.split('\n')[0]; // First line only
			}

			if (!status) {
				const statusLevels = Object.keys(config.statusLevels);
				const statusLabel = issue.labels.find((l) => statusLevels.includes(l.name.toLowerCase()));
				if (statusLabel) {
					status = statusLabel.name.toLowerCase();
				}
			}

			if (!status) {
				status = issue.state === 'closed' ? 'operational' : 'major';
			}

			if (issue.state === 'closed') {
				status = 'operational';
				message = message || 'Resolved';
			}

			statuses[monitorName] = {
				status,
				message: message || issue.title,
				issueNumber: issue.number,
				issueUrl: issue.html_url,
				updatedAt: issue.updated_at
			};
		}
	} catch (e) {
		console.warn('Error fetching manual monitor statuses:', e.message);
	}

	return statuses;
}

//? ============================================================================
//? Issue/Incident Transformation
//? ============================================================================

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

function matchesPattern(pattern, target) {
	if (!pattern || !target) return false;

	const lowerPattern = pattern.toLowerCase();
	const lowerTarget = target.toLowerCase();

	if (lowerPattern === lowerTarget) return true;

	if (lowerPattern.includes('*')) {
		const regexPattern = lowerPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
		const regex = new RegExp(`^${regexPattern}$`);
		return regex.test(lowerTarget);
	}

	return false;
}

function incidentAffectsMonitor(incident, monitor, groupName = null) {
	const hasMonitors = incident.monitors && incident.monitors.length > 0;
	const hasGroups = incident.groups && incident.groups.length > 0;

	if (!hasMonitors && !hasGroups) {
		return true;
	}

	if (groupName && hasGroups) {
		for (const incidentGroup of incident.groups) {
			if (incidentGroup.toLowerCase() === groupName.toLowerCase()) {
				return true;
			}
		}
	}

	if (hasMonitors) {
		for (const pattern of incident.monitors) {
			if (matchesPattern(pattern, monitor.name)) {
				return true;
			}

			if (monitor.target) {
				try {
					const url = new URL(monitor.target);
					if (matchesPattern(pattern, url.hostname)) {
						return true;
					}
				} catch {
					if (matchesPattern(pattern, monitor.target)) {
						return true;
					}
				}
			}
		}
	}

	return false;
}

function getWorstIncidentStatus(monitor, incidents, config, groupName = null) {
	let worstStatus = null;
	let worstPriority = -1;

	const activeIncidents = incidents.filter((i) => !i.isResolved && !i.isUpcoming);

	for (const incident of activeIncidents) {
		if (incidentAffectsMonitor(incident, monitor, groupName)) {
			const priority = config.statusLevels[incident.status]?.priority ?? 0;
			if (priority > worstPriority) {
				worstPriority = priority;
				worstStatus = incident.status;
			}
		}
	}

	return worstStatus;
}

function applyIncidentStatusToMonitors(monitors, incidents, config, groupName = null) {
	const activeIncidents = incidents.filter((i) => !i.isResolved && !i.isUpcoming);

	return monitors.map((monitor) => {
		let worstStatus = null;
		let worstPriority = -1;
		const affectingIncidents = [];

		for (const incident of activeIncidents) {
			if (incidentAffectsMonitor(incident, monitor, groupName)) {
				const priority = config.statusLevels[incident.status]?.priority ?? 0;
				if (priority > worstPriority) {
					worstPriority = priority;
					worstStatus = incident.status;
				}
				affectingIncidents.push(incident);
			}
		}

		return {
			...monitor,
			incidentStatus: worstStatus,
			affectingIncidents
		};
	});
}

//? ============================================================================
//? Main
//? ============================================================================

async function main() {
	console.log('Starting monitor checks...');

	if (!existsSync(monitorsPath)) {
		console.log('No monitors.json found, skipping checks.');
		return;
	}

	if (!existsSync(configPath)) {
		console.log('No config.json found, skipping checks.');
		return;
	}

	const config = JSON.parse(readFileSync(configPath, 'utf-8'));
	const monitorsConfig = JSON.parse(readFileSync(monitorsPath, 'utf-8'));

	const allMonitorsWithGroups = [];

	if (monitorsConfig.groups) {
		for (const group of monitorsConfig.groups) {
			if (group.monitors) {
				for (const monitor of group.monitors) {
					allMonitorsWithGroups.push({ ...monitor, _groupName: group.name });
				}
			}
		}
	}

	if (monitorsConfig.monitors) {
		for (const monitor of monitorsConfig.monitors) {
			allMonitorsWithGroups.push({ ...monitor, _groupName: null });
		}
	}

	if (allMonitorsWithGroups.length === 0) {
		console.log('No monitors configured, skipping checks.');
		return;
	}

	console.log(`Checking ${allMonitorsWithGroups.length} monitors...`);

	let incidents = [];
	const hasGitHubConfig =
		config.github?.owner &&
		config.github?.repo &&
		config.github.owner !== 'YOUR_USERNAME' &&
		config.github.repo !== 'YOUR_REPO';

	let manualStatuses = {};
	let announcements = {};

	if (hasGitHubConfig) {
		console.log('Fetching incidents from GitHub...');

		const [incidentIssues, maintenanceIssues, manualStatusResult, announcementIssues] =
			await Promise.all([
				fetchIssuesWithLabel(config.github.owner, config.github.repo, config.github.issuesLabel),
				fetchIssuesWithLabel(
					config.github.owner,
					config.github.repo,
					config.github.maintenanceLabel
				),
				fetchManualMonitorStatuses(
					config.github.owner,
					config.github.repo,
					config.github.manualMonitorLabel,
					config
				),
				fetchIssuesWithLabel(
					config.github.owner,
					config.github.repo,
					config.github.announcementLabel
				)
			]);

		manualStatuses = manualStatusResult;

		const filteredAnnounce = announcementIssues.filter((i) => i.state === 'open');
		const announceNumbers = filteredAnnounce.map((issue) => issue.number);
		const announceCommentsMap = await fetchCommentsForIssues(
			config.github.owner,
			config.github.repo,
			announceNumbers
		);
		announcements = transformIssues(filteredAnnounce, config, announceCommentsMap);

		const issueMap = new Map();
		for (const issue of [...incidentIssues, ...maintenanceIssues]) {
			issueMap.set(issue.number, issue);
		}
		const issues = Array.from(issueMap.values());

		console.log(`  Found ${issues.length} issue(s)`);

		if (Object.keys(manualStatuses).length > 0) {
			console.log(`  Found ${Object.keys(manualStatuses).length} manual monitor status(es)`);
		}
		if (Object.keys(announcements).length > 0) {
			console.log(`  Found ${Object.keys(announcements).length} announcement(s)`);
		}

		const issueNumbers = issues.map((issue) => issue.number);
		const commentsMap = await fetchCommentsForIssues(
			config.github.owner,
			config.github.repo,
			issueNumbers
		);

		incidents = transformIssues(issues, config, commentsMap);
	}

	const history = loadHistory();
	const notificationState = loadNotificationState();

	const results = await Promise.all(
		allMonitorsWithGroups.map((monitor) => checkMonitor(monitor, history, config, manualStatuses))
	);

	// Process notifications
	const notificationsEnabled = config.notifications?.discord || config.notifications?.webhook;
	if (notificationsEnabled) {
		console.log('Processing notifications...');
	}

	for (let i = 0; i < results.length; i++) {
		const result = results[i];
		const monitor = allMonitorsWithGroups[i];

		const incidentStatus = getWorstIncidentStatus(monitor, incidents, config, monitor._groupName);

		if (incidentStatus) {
			console.log(`  ${result.name}: ${result.status} -> ${incidentStatus} (incident override)`);
			result.status = incidentStatus;
			result.incidentOverride = true;
		} else {
			console.log(`  ${result.name}: ${result.status} (${result.responseTime ?? 'N/A'}ms)`);
		}

		// Check if we should send a notification for this monitor
		if (notificationsEnabled) {
			const notifyResult = shouldNotify(monitor, result.status, notificationState, config);

			if (notifyResult.shouldSend) {
				console.log(`  -> Sending notification: ${notifyResult.reason}`);
				await sendNotifications(
					{ ...monitor, message: result.message, responseTime: result.responseTime },
					result.status,
					notifyResult.previousStatus,
					config
				);
			}

			// Update notification state
			updateNotificationState(notificationState, monitor.name, result.status, notifyResult);
		}

		recordCheck(history, result, config);
	}

	cleanupOldHistory(history, 90);
	saveHistory(history);
	saveNotificationState(notificationState);

	console.log('Building status.json...');

	const ungroupedMonitors = [];
	for (const monitor of monitorsConfig.monitors ?? []) {
		const result = results.find((r) => r.name === monitor.name);
		const monitorData = {
			...monitor,
			status: result?.status ?? 'operational',
			responseTime: result?.responseTime ?? null,
			statusCode: result?.statusCode ?? null,
			message: result?.message ?? null,
			incidentOverride: result?.incidentOverride ?? false
		};

		if (monitor.showHistory) {
			monitorData.history = getDailyHistory(history, monitor.name, 90);
			monitorData.uptime = getUptimePercentage(history, monitor.name, 90);
		}

		ungroupedMonitors.push(monitorData);
	}

	const groups = [];
	for (const group of monitorsConfig.groups ?? []) {
		const groupMonitors = [];

		for (const monitor of group.monitors ?? []) {
			const result = results.find((r) => r.name === monitor.name);
			const monitorData = {
				...monitor,
				status: result?.status ?? 'operational',
				responseTime: result?.responseTime ?? null,
				statusCode: result?.statusCode ?? null,
				message: result?.message ?? null,
				incidentOverride: result?.incidentOverride ?? false
			};

			if (monitor.showHistory) {
				monitorData.history = getDailyHistory(history, monitor.name, 90);
				monitorData.uptime = getUptimePercentage(history, monitor.name, 90);
			}

			groupMonitors.push(monitorData);
		}

		const monitorNames = groupMonitors.map((m) => m.name);
		const showGroupHistory = group.showGroupHistory ?? false;

		let groupHistory = [];
		let groupUptime = null;

		if (showGroupHistory && monitorNames.length > 0) {
			groupHistory = getGroupDailyHistory(history, monitorNames, 90, config);
			groupUptime = getGroupUptimePercentage(history, monitorNames, 90);
		}

		groups.push({
			name: group.name,
			description: group.description,
			defaultOpen: group.defaultOpen ?? true,
			showGroupStatus: group.showGroupStatus ?? true,
			showGroupHistory,
			history: groupHistory,
			uptime: groupUptime,
			monitors: groupMonitors
		});
	}

	const monitorsWithIncidents = applyIncidentStatusToMonitors(ungroupedMonitors, incidents, config);
	const groupsWithIncidents = groups.map((group) => ({
		...group,
		monitors: applyIncidentStatusToMonitors(group.monitors, incidents, config, group.name)
	}));

	const statusData = {
		incidents,
		monitors: monitorsWithIncidents,
		monitorGroups: groupsWithIncidents,
		announcements,
		lastUpdated: new Date().toISOString()
	};

	writeFileSync(statusPath, JSON.stringify(statusData, null, 2));

	console.log('Monitor checks complete. History and status.json updated.');
}

main().catch((error) => {
	console.error('Error running monitor checks:', error);
	process.exit(1);
});
