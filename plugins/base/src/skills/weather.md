# Weather Skill

Get current weather conditions and forecasts.

## When to Use

✅ **USE this skill when:**

- "What's the weather?"
- "Will it rain today/tomorrow?"
- "Temperature in [city]"
- "Weather forecast for the week"
- Travel planning weather checks

## When NOT to Use

❌ **DON'T use this skill when:**

- Historical weather data → use weather archives/APIs
- Climate analysis or trends → use specialized data sources
- Hyper-local microclimate data → use local sensors
- Severe weather alerts → check official NWS sources
- Aviation/marine weather → use specialized services (METAR, etc.)

## Location

Always include a city, region, or airport code in weather queries.

## Tool to Use

Use `plugin.base.http_request` (tool name: `http_request`) for all weather requests.

### Current Weather (examples)

```json
{
  "toolName": "plugin.base.http_request",
  "arguments": {
    "method": "GET",
    "url": "https://wttr.in/London?format=3"
  }
}
```

```json
{
  "toolName": "plugin.base.http_request",
  "arguments": {
    "method": "GET",
    "url": "https://wttr.in/New+York?0"
  }
}
```

### Forecasts (examples)

```json
{
  "toolName": "plugin.base.http_request",
  "arguments": {
    "method": "GET",
    "url": "https://wttr.in/London?format=v2"
  }
}
```

```json
{
  "toolName": "plugin.base.http_request",
  "arguments": {
    "method": "GET",
    "url": "https://wttr.in/London?1"
  }
}
```

### Format Codes

- `%c` — Weather condition emoji
- `%t` — Temperature
- `%f` — "Feels like"
- `%w` — Wind
- `%h` — Humidity
- `%p` — Precipitation
- `%l` — Location

## Quick Responses

**"What's the weather?"**

```json
{
  "toolName": "plugin.base.http_request",
  "arguments": {
    "method": "GET",
    "url": "https://wttr.in/London?format=%25l:+%25c+%25t+(feels+like+%25f),+%25w+wind,+%25h+humidity"
  }
}
```

**"Will it rain?"**

```json
{
  "toolName": "plugin.base.http_request",
  "arguments": {
    "method": "GET",
    "url": "https://wttr.in/London?format=%25l:+%25c+%25p"
  }
}
```

**"Weekend forecast"**

```json
{
  "toolName": "plugin.base.http_request",
  "arguments": {
    "method": "GET",
    "url": "https://wttr.in/London?format=v2"
  }
}
```

## Notes

- No API key needed (uses wttr.in)
- Rate limited; don't spam requests
- Works for most global cities
- Supports airport codes, e.g. `https://wttr.in/ORD`
