# Health Check API

## GET /health

Returns the health status of the API. Used by Docker healthchecks and load balancers.

### Response
**Status:** `200 OK`

```json
{
  "status": "ok",
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```
