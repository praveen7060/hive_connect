# Smart Meter Analytics API

Base path: `/api/smartmeter/:deviceId/analytics`

All timestamps are ISO 8601 strings. If you pass a timezone offset, URL-encode `+` as `%2B`.

## Summary
`GET /summary`

Query params:
- `from` (optional) ISO datetime
- `to` (optional) ISO datetime
- `meter` (optional) meter identifier string

Response fields:
- `deviceId`, `meter`, `range`
- `samples`: number of rows in range
- `averages`, `minimums`, `maximums`: `voltage1`, `voltage2`, `current`, `powerFactor`, `power`, `frequency`
- `machine`: `on`, `off`, `unknown`, `onRatio`
- `first`, `latest`: full SmartMeterData row objects

Example:
```http
GET /api/smartmeter/IOTIQSM_A1125004/analytics/summary?from=2026-02-01T00:00:00Z&to=2026-02-09T23:59:59Z
```

Sample response:
```json
{
  "deviceId": "IOTIQSM_A1125004",
  "meter": null,
  "range": {
    "from": "2026-02-01T00:00:00.000Z",
    "to": "2026-02-09T23:59:59.000Z"
  },
  "samples": 1280,
  "averages": {
    "voltage1": 410.2,
    "voltage2": 237.1,
    "current": 17.3,
    "powerFactor": 0.96,
    "power": 3.15,
    "frequency": 49.98
  },
  "minimums": {
    "voltage1": 408.4,
    "voltage2": 234.9,
    "current": 12.1,
    "powerFactor": 0.91,
    "power": 2.2,
    "frequency": 49.7
  },
  "maximums": {
    "voltage1": 414.9,
    "voltage2": 239.6,
    "current": 20.4,
    "powerFactor": 0.99,
    "power": 3.8,
    "frequency": 50.1
  },
  "machine": {
    "on": 1200,
    "off": 60,
    "unknown": 20,
    "onRatio": 0.94
  },
  "first": { "id": "...", "createdAt": "..." },
  "latest": { "id": "...", "createdAt": "..." }
}
```

## Series
`GET /series`

Query params:
- `from` (optional) ISO datetime
- `to` (optional) ISO datetime
- `bucket` (optional) one of `minute|hour|day|week|month` (default `hour`)
- `meter` (optional)

Response fields:
- `deviceId`, `meter`, `bucket`, `range`
- `series`: array of buckets with `count`, averaged fields, and `machine.onRatio`

Example:
```http
GET /api/smartmeter/IOTIQSM_A1125004/analytics/series?bucket=day&from=2026-02-01T00:00:00Z&to=2026-02-09T23:59:59Z
```

Sample response:
```json
{
  "deviceId": "IOTIQSM_A1125004",
  "meter": null,
  "bucket": "day",
  "range": {
    "from": "2026-02-01T00:00:00.000Z",
    "to": "2026-02-09T23:59:59.000Z"
  },
  "series": [
    {
      "bucket": "2026-02-01T00:00:00.000Z",
      "count": 160,
      "averages": {
        "voltage1": 410.1,
        "voltage2": 236.9,
        "current": 17.2,
        "powerFactor": 0.96,
        "power": 3.12,
        "frequency": 49.98
      },
      "machine": {
        "onRatio": 0.95
      }
    }
  ]
}
```

## Live Stats
`GET /live`

Query params:
- `windowMinutes` (optional) rolling window in minutes (default `15`, max `10080`)
- `meter` (optional)

Response fields:
- same as `summary`, plus `windowMinutes` and a `range` from now-window to now
- `latest` is the most recent sample in the window

Example:
```http
GET /api/smartmeter/IOTIQSM_A1125004/analytics/live?windowMinutes=15
```

## Continuous Trend
`GET /trend`

Query params:
- `minutes` (optional) rolling window in minutes (default `120`, max `10080`)
- `bucket` (optional) one of `minute|hour|day|week|month` (default `minute`)
- `meter` (optional)

Response fields:
- same shape as `series`, but uses a rolling window of `now - minutes`

Example:
```http
GET /api/smartmeter/IOTIQSM_A1125004/analytics/trend?minutes=360&bucket=minute
```

## Errors
- `400` Invalid date/bucket/window or not a smart meter device
- `404` Device not found
- `500` Internal server error
