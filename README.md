# Shadow Status

A lightweight, static status page platform designed for GitHub Pages. Monitor your services, display incidents, and keep users informed - all without a database or backend server.

[Get Shadow Status from Our Site](https://shadowdevs.com/store/shadowstatus) or [Releases Page](https://github.com/Shadow-Develops/ShadowStatus/releases)

_Created by [Shadow Development](https://shadowdevs.com)_

## Features

- 10 monitor types (HTTP, TCP, Ping, DNS, SSL/TLS, Steam, Minecraft, and more)
- Three monitor layout modes: default cards, compact table, and responsive grid
- Configurable page section order
- Response time trend graph (toggleable per monitor alongside the 90-day status chart)
- Search and filter monitors by name, status, and group
- Collapse / expand all groups at once
- GitHub Issues integration for incident management
- Discord notifications
- 90-day uptime history
- Fully static - deploys to GitHub Pages
- No database required

## Documentation

For detailed setup guides, advanced configuration, and deployment instructions, visit our **[official documentation site](https://docs.shadowdevs.com/shadowStatus)**.

## Quick Start

### Prerequisites

- Node.js 20+
- npm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run monitor checks manually
npm run check-monitors
```

### Environment Variables

Set these as GitHub Secrets:

| Variable          | Required | Description                           |
| ----------------- | -------- | ------------------------------------- |
| `GIT_TOKEN`       | Yes      | GitHub Personal Access Token          |
| `DISCORD_WEBHOOK` | No       | Discord webhook URL for notifications |
| `WEBHOOK_URL`     | No       | Custom webhook URL                    |

## Configuration

### static/CNAME

Make sure your custom domain is here, otherwise your Github Repo URL will be used.

### config.json

```json
{
	"domain": "status.shadowdevs.com",
	"majorOutageThreshold": 2,
	"siteSettings": {
		"siteName": "Shadow Status",
		"siteDescription": "A simple status page to show all Shadow Development Services. Hosted on Github Pages for reliable 24/7 uptime!",
		"metaColor": "#3b5998"
	},
	"github": {
		"owner": "Shadow-Develops",
		"repo": "ShadowStatus",
		"issuesLabel": "incident",
		"manualMonitorLabel": "manual",
		"maintenanceLabel": "maintenance",
		"announcementLabel": "announce"
	},
	"design": {
		"pageWidth": "auto",
		"useLogo": "/img/Banner.png",
		"logoDimensions": {
			"width": 300,
			"height": 300
		},
		"showSiteName": true,
		"showDescription": false,
		"showOverallStatus": true,
		"footer": {
			"enabled": true,
			"credits": true
		},
		"statusDot": {
			"enabled": {
				"group": false,
				"monitor": true
			},
			"animation": {
				"group": false,
				"monitor": "ping"
			}
		},
		"recentIncidents": {
			"active": true,
			"number": 5
		},
		"incident": {
			"showCommentAuthor": false,
			"showGithubLink": true
		},
		"announcement": {
			"showIcon": true,
			"showTitle": false,
			"showCommentAuthor": false,
			"showGithubLink": true
		},
		"historyGraph": {
			"defaultTab": "status",
			"showStatusTab": true,
			"showResponseTimeTab": true
		},
		"monitors": {
			"layout": "default",
			"gridColumns": 2,
			"showFilterBar": true,
			"showSearch": true,
			"showStatusFilter": true,
			"showGroupFilter": true,
			"showCollapseButtons": true,
			"showMonitorType": true,
			"showSSL": true
		},
		"pageOrder": [
			"overall-status",
			"announcements",
			"active-incidents",
			"monitors",
			"upcoming-maintenance",
			"recent-incidents"
		]
	},
	"overallStatusText": {
		"operational": "All systems are running smoothly.",
		"degraded": "Some systems are experiencing issues.",
		"major": "We're experiencing a major outage.",
		"maintenance": "Scheduled maintenance is in progress."
	},
	"statusLevels": {
		"operational": {
			"label": "Operational",
			"color": "success",
			"priority": 0
		},
		"degraded": {
			"label": "Degraded Performance",
			"color": "warning",
			"priority": 1
		},
		"partial": {
			"label": "Partial Outage",
			"color": "warning",
			"priority": 2
		},
		"major": {
			"label": "Major Outage",
			"color": "error",
			"priority": 3
		},
		"maintenance": {
			"label": "Under Maintenance",
			"color": "info",
			"priority": 4
		}
	},
	"notifications": {
		"defaultEnabled": true,
		"numberOfDown": 1,
		"discord": {
			"enabled": true,
			"defaultPingRole": "everyone",
			"pingForReturn": false
		},
		"webhook": false
	}
}
```

### monitors.json

Example configuration showcasing all available monitor types:

```json
{
	"groups": [
		{
			"name": "Web Services",
			"description": "Our main websites and APIs",
			"defaultOpen": true,
			"showGroupStatus": true,
			"showGroupHistory": false,
			"monitors": [
				{
					"name": "Main Website",
					"description": "Primary company website",
					"type": "http",
					"target": "https://example.com",
					"expectedStatus": [200, 201, 204],
					"timeout": 10000,
					"showTarget": true,
					"showHistory": true,
					"notify": true
				},
				{
					"name": "API Health",
					"type": "json",
					"target": "https://api.example.com/health",
					"jsonPath": "status",
					"expectedValue": "ok",
					"showTarget": true,
					"showHistory": true
				},
				{
					"name": "Main Website SSL",
					"type": "ssl",
					"target": "example.com",
					"warnDays": 14,
					"criticalDays": 7,
					"showTarget": true,
					"showHistory": true
				}
			]
		},
		{
			"name": "Game Servers",
			"defaultOpen": true,
			"showGroupStatus": true,
			"monitors": [
				{
					"name": "Minecraft Server",
					"type": "minecraft",
					"target": "mc.example.com:25565",
					"showTarget": true,
					"showHistory": true
				},
				{
					"name": "Steam Game Server",
					"type": "steam",
					"target": "192.168.1.100:27015",
					"showTarget": true,
					"showHistory": true
				}
			]
		},
		{
			"name": "Infrastructure",
			"defaultOpen": false,
			"showGroupStatus": true,
			"monitors": [
				{
					"name": "Database Server",
					"type": "tcp",
					"target": "db.example.com:5432",
					"showTarget": false,
					"showHistory": true
				},
				{
					"name": "Gateway",
					"type": "ping",
					"target": "192.168.1.1",
					"showHistory": true,
					"timeout": 5
				},
				{
					"name": "DNS Resolution",
					"type": "dns",
					"target": "example.com",
					"recordType": "A",
					"expectedIp": "93.184.216.34",
					"showHistory": true
				}
			]
		}
	],
	"monitors": [
		{
			"name": "Cloudflare Status",
			"type": "statuspage",
			"target": "https://www.cloudflarestatus.com",
			"showTarget": true,
			"showHistory": true
		},
		{
			"name": "Manual Service",
			"type": "manual",
			"showHistory": true,
			"notify": false
		}
	]
}
```

## Monitor Types

| Type         | Description                        | Target Format                      |
| ------------ | ---------------------------------- | ---------------------------------- |
| `http`       | HTTP/HTTPS endpoint checks         | `https://example.com`              |
| `ping`       | ICMP ping to host                  | `192.168.1.1` or `hostname`        |
| `tcp`        | TCP port connectivity              | `host:port`                        |
| `dns`        | DNS resolution checks              | `example.com`                      |
| `ssl`        | SSL/TLS certificate expiry         | `example.com` or `example.com:443` |
| `json`       | JSON API value checking            | `https://api.example.com/status`   |
| `statuspage` | Third-party Atlassian status pages | `https://status.example.com`       |
| `steam`      | Steam game server status           | `host:port` (default: 27015)       |
| `minecraft`  | Minecraft server status            | `host:port` (default: 25565)       |
| `manual`     | Manually set via GitHub Issues     | N/A                                |

### Monitor Options

| Option           | Type    | Description                                         |
| ---------------- | ------- | --------------------------------------------------- |
| `name`           | string  | Display name                                        |
| `type`           | string  | Monitor type (see above)                            |
| `target`         | string  | What to monitor                                     |
| `description`    | string  | Optional description                                |
| `showTarget`     | boolean | Show target URL publicly                            |
| `showHistory`    | boolean | Display 90-day status chart and response time graph |
| `notify`         | boolean | Send notifications                                  |
| `inverse`        | boolean | Reverse logic (down = operational)                  |
| `applyToOverall` | boolean | Include in overall status                           |
| `expectedStatus` | array   | HTTP status codes (http only)                       |
| `timeout`        | number  | Request timeout in ms (in seconds for ping)         |
| `jsonPath`       | string  | Path to value (json only)                           |
| `expectedValue`  | any     | Expected value (json only)                          |
| `recordType`     | string  | DNS record type (dns only)                          |
| `expectedIp`     | string  | Expected IP (dns only)                              |
| `warnDays`       | number  | Days before expiry to warn (ssl, default 14)        |
| `criticalDays`   | number  | Days before expiry to go critical (ssl, default 7)  |

### History Graph Settings (`config.json` → `design.historyGraph`)

Controls the 90-day history chart that appears below each monitor.

| Setting               | Type    | Default    | Description                                                |
| --------------------- | ------- | ---------- | ---------------------------------------------------------- |
| `defaultTab`          | string  | `"status"` | Which tab is shown by default — `"status"` or `"response"` |
| `showStatusTab`       | boolean | `true`     | Show the 90-day status bar chart tab                       |
| `showResponseTimeTab` | boolean | `true`     | Show the response time line graph tab                      |

**Examples:**

Show response time graph by default:

```json
"historyGraph": { "defaultTab": "response", "showStatusTab": true, "showResponseTimeTab": true }
```

Status bars only (no response time tab):

```json
"historyGraph": { "defaultTab": "status", "showStatusTab": true, "showResponseTimeTab": false }
```

Response time only (no status bars):

```json
"historyGraph": { "defaultTab": "response", "showStatusTab": false, "showResponseTimeTab": true }
```

> When only one tab is enabled, the tab buttons are hidden and that view is shown directly with no toggle.

### Page Width (`config.json` → `design.pageWidth`)

Controls the maximum width of the page content area.

| Value    | CSS class      | Description                                    |
| -------- | -------------- | ---------------------------------------------- |
| `"auto"` | _(calculated)_ | Default — width determined by layout/grid size |
| `"3xl"`  | `max-w-3xl`    | ~768px                                         |
| `"4xl"`  | `max-w-4xl`    | ~896px                                         |
| `"5xl"`  | `max-w-5xl`    | ~1024px                                        |
| `"6xl"`  | `max-w-6xl`    | ~1152px                                        |
| `"7xl"`  | `max-w-7xl`    | ~1280px                                        |

When set to `"auto"` (or omitted), the width adapts based on the monitor layout and `gridColumns` setting. Set an explicit value to override this behavior.

### Monitor Display Settings (`config.json` → `design.monitors`)

Controls the layout and filter bar for the monitor section.

| Setting               | Type    | Default     | Description                                                                                                  |
| --------------------- | ------- | ----------- | ------------------------------------------------------------------------------------------------------------ |
| `layout`              | string  | `"default"` | Monitor layout: `"default"` (stacked cards), `"table"` (compact rows), or `"grid"` (multi-column cards)      |
| `gridColumns`         | number  | `2`         | Columns in grid layout. Page width auto-adjusts: 2→`max-w-3xl`, 3→`max-w-5xl`, 4→`max-w-6xl`, 5+→`max-w-7xl` |
| `showFilterBar`       | boolean | `true`      | Show or hide the entire search/filter bar                                                                    |
| `showSearch`          | boolean | `true`      | Show the text search input                                                                                   |
| `showStatusFilter`    | boolean | `true`      | Show the status filter dropdown                                                                              |
| `showGroupFilter`     | boolean | `true`      | Show the group filter dropdown                                                                               |
| `showCollapseButtons` | boolean | `true`      | Show expand/collapse all buttons (default layout only)                                                       |
| `showMonitorType`     | boolean | `true`      | Show the monitor type badge (e.g. `http`, `tcp`) on each monitor card                                        |
| `showSSL`             | boolean | `true`      | Show SSL days-remaining info on `ssl` monitors                                                               |

**Layout examples:**

Table layout (Checkmate-style):

```json
"monitors": { "layout": "table" }
```

3-column grid (Gatus-style):

```json
"monitors": { "layout": "grid", "gridColumns": 3 }
```

Minimal — no filter bar:

```json
"monitors": { "layout": "default", "showFilterBar": false }
```

> In `table` and `grid` modes, groups are shown as divider labels rather than collapsible containers.

### Monitor Search & Filter

The search and filter bar appears automatically above the monitor list. Each control can be individually disabled via `design.monitors` settings above.

| Control                   | Description                                                                      |
| ------------------------- | -------------------------------------------------------------------------------- |
| **Search box**            | Filters monitors by name (case-insensitive substring match)                      |
| **Status dropdown**       | Shows only monitors with a specific status (e.g. Degraded, Major Outage)         |
| **Group dropdown**        | Shows only monitors from a selected group, or "Ungrouped" for top-level monitors |
| **Clear button**          | Resets all active filters (appears only when a filter is active)                 |
| **Expand / Collapse all** | Opens or closes all groups simultaneously (default layout only)                  |

When filters produce no results, a "No monitors match your filters." message is shown in place of the list.

### Page Section Order (`config.json` → `design.pageOrder`)

Controls the order in which page sections are rendered. Omit a section ID to hide it entirely.

**Default order:**

```json
"pageOrder": [
  "overall-status",
  "announcements",
  "active-incidents",
  "monitors",
  "upcoming-maintenance",
  "recent-incidents"
]
```

| Section ID             | Description                              |
| ---------------------- | ---------------------------------------- |
| `overall-status`       | The overall system status banner         |
| `announcements`        | Service announcements from GitHub Issues |
| `active-incidents`     | Currently active incidents               |
| `monitors`             | The full monitor list with filter bar    |
| `upcoming-maintenance` | Scheduled future maintenance windows     |
| `recent-incidents`     | Recently resolved incidents              |

Unknown IDs are silently ignored. To hide a section, remove it from the array.

## Monitor Check Frequency

By default, the GitHub Actions workflow runs every **45 minutes**. This is because GitHub Actions scheduled workflows can be delayed during high load periods, making intervals shorter than 15 minutes is quite unreliable.\
The idea is that the cron-job.org will run the 15 minute checks, and it is much more reliable to call the action through the API then relying on GitHub. You can always change the workflow to a 15 minute timer and not use cron-job.org if you want. Just know, your updates could be delayed at times.

### Setting Up 15-Minute Checks with cron-job.org

For more frequent monitoring, use a free external cron service like [cron-job.org](https://cron-job.org) to trigger the workflow via GitHub's API.

#### 1. Create a GitHub Personal Access Token

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. Click **Generate new token**
3. Set **Repository access** to "Only select repositories" and choose your ShadowStatus repo
4. Under **Permissions**, grant **Actions** read and write access
5. Generate and copy the token

#### 2. Configure cron-job.org

1. Create a free account at [cron-job.org](https://cron-job.org)
2. Create a new cron job with these settings:

| Setting            | Value                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| **URL**            | `https://api.github.com/repos/YOUR_USERNAME/YOUR_REPO/actions/workflows/monitor-checks.yml/dispatches` |
| **Schedule**       | Every 15 minutes                                                                                       |
| **Request Method** | POST                                                                                                   |

3. Add these **Headers**:

```
Authorization: Bearer YOUR_GITHUB_TOKEN
Accept: application/vnd.github+v3+json
Content-Type: application/json
```

4. Set the **Request Body**:

```json
{ "ref": "main" }
```

The GitHub Actions workflow will continue running every 30 minutes as a fallback in case the external cron service fails
