# Shadow Status

A lightweight, static status page platform designed for GitHub Pages. Monitor your services, display incidents, and keep users informed - all without a database or backend server.

[Get Shadow Status from Our Site](https://shadowdevs.com/store/shadowstatus) or [Releases Page](https://github.com/Shadow-Develops/ShadowStatus/releases)

_Created by [Shadow Development](https://shadowdevs.com)_

## Features

- 9 monitor types (HTTP, TCP, Ping, DNS, Steam, Minecraft, and more)
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
		}
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

| Type         | Description                        | Target Format                    |
| ------------ | ---------------------------------- | -------------------------------- |
| `http`       | HTTP/HTTPS endpoint checks         | `https://example.com`            |
| `ping`       | ICMP ping to host                  | `192.168.1.1` or `hostname`      |
| `tcp`        | TCP port connectivity              | `host:port`                      |
| `dns`        | DNS resolution checks              | `example.com`                    |
| `json`       | JSON API value checking            | `https://api.example.com/status` |
| `statuspage` | Third-party Atlassian status pages | `https://status.example.com`     |
| `steam`      | Steam game server status           | `host:port` (default: 27015)     |
| `minecraft`  | Minecraft server status            | `host:port` (default: 25565)     |
| `manual`     | Manually set via GitHub Issues     | N/A                              |

### Monitor Options

| Option           | Type    | Description                        |
| ---------------- | ------- | ---------------------------------- |
| `name`           | string  | Display name                       |
| `type`           | string  | Monitor type (see above)           |
| `target`         | string  | What to monitor                    |
| `description`    | string  | Optional description               |
| `showTarget`     | boolean | Show target URL publicly           |
| `showHistory`    | boolean | Display 90-day history             |
| `notify`         | boolean | Send notifications                 |
| `inverse`        | boolean | Reverse logic (down = operational) |
| `applyToOverall` | boolean | Include in overall status          |
| `expectedStatus` | array   | HTTP status codes (http only)      |
| `timeout`        | number  | Request timeout in ms (ping only)  |
| `jsonPath`       | string  | Path to value (json only)          |
| `expectedValue`  | any     | Expected value (json only)         |
| `recordType`     | string  | DNS record type (dns only)         |
| `expectedIp`     | string  | Expected IP (dns only)             |
