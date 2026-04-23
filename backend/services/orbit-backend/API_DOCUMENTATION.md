# Orbit Backend API Documentation

This documentation is generated from the current codebase in `src/` and Prisma schema.

## 1. Base URL and Server

- Local base URL: `http://localhost:5000`
- API prefix: `/api`
- Health check (no prefix): `GET /health`

Example:

```http
GET http://localhost:5000/health
```

Response:

```json
{
  "status": "ok"
}
```

## 2. Auth and Headers

- `Content-Type: application/json` for request bodies.
- CORS is enabled globally (`cors()` with default settings).
- Authentication has been removed from this service.
- No login/register/token endpoints are available.
- No `Authorization: Bearer ...` header is required.

## 3. Common Response Behavior

## Success

- `GET` list: `200` + array
- `GET` by id: `200` + object
- `POST`: `201` + created object
- `PUT`: `200` + updated object
- `DELETE`: `204` + empty body

## Error shape

Most errors return:

```json
{
  "message": "..."
}
```

Important implementation detail:

- Validation errors from DTO validators currently throw plain `Error`, so they become `500` (not `400`) via `errorMiddleware`.
- Missing/invalid `:id` only checks `Number.isNaN`, so some non-integer values can surface as Prisma errors (`500`).
- Update/delete of non-existent records can return Prisma errors (`500`) depending on operation.

## 4. Endpoints Overview

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/vendors` | List vendors |
| GET | `/api/vendors/:id` | Get vendor by id |
| POST | `/api/vendors` | Create vendor |
| PUT | `/api/vendors/:id` | Update vendor |
| DELETE | `/api/vendors/:id` | Delete vendor |
| GET | `/api/parameters` | List parameters |
| GET | `/api/parameters/:id` | Get parameter by id |
| POST | `/api/parameters` | Create parameter |
| PUT | `/api/parameters/:id` | Update parameter |
| DELETE | `/api/parameters/:id` | Delete parameter |
| GET | `/api/item-types` | List item types |
| GET | `/api/item-types/:id` | Get item type by id |
| POST | `/api/item-types` | Create item type |
| PUT | `/api/item-types/:id` | Update item type |
| DELETE | `/api/item-types/:id` | Delete item type |
| GET | `/api/communications` | List communications |
| GET | `/api/communications/:id` | Get communication by id |
| POST | `/api/communications` | Create communication |
| PUT | `/api/communications/:id` | Update communication |
| DELETE | `/api/communications/:id` | Delete communication |
| GET | `/api/messages` | List messages |
| GET | `/api/messages/:id` | Get message by id |
| POST | `/api/messages` | Create message |
| PUT | `/api/messages/:id` | Update message |
| DELETE | `/api/messages/:id` | Delete message |
| GET | `/api/items` | List items |
| GET | `/api/items/:id` | Get item by id |
| POST | `/api/items` | Create item |
| PUT | `/api/items/:id` | Update item |
| DELETE | `/api/items/:id` | Delete item |
| GET | `/api/devices` | List devices |
| GET | `/api/devices/:id` | Get device by id |
| POST | `/api/devices` | Create device |
| PUT | `/api/devices/:id` | Update device |
| DELETE | `/api/devices/:id` | Delete device |

## 5. Detailed API Contracts

## 5.1 Vendors

Entity shape:

```json
{
  "id": 1,
  "name": "Vendor A",
  "type": "Hardware",
  "industry": "IoT",
  "authType": "OAuth2",
  "description": "Optional",
  "createdAt": "2026-03-11T12:00:00.000Z",
  "updatedAt": "2026-03-11T12:00:00.000Z"
}
```

Create body (`POST /api/vendors`):

```json
{
  "name": "Vendor A",
  "type": "Hardware",
  "industry": "IoT",
  "authType": "OAuth2",
  "description": "Optional"
}
```

Required fields: `name`, `type`, `industry`, `authType`

Update body (`PUT /api/vendors/:id`): any subset of create fields.

Other routes:

- `GET /api/vendors`
- `GET /api/vendors/:id`
- `DELETE /api/vendors/:id`

## 5.3 Parameters

Entity shape:

```json
{
  "id": 1,
  "name": "Temperature",
  "variableType": "number",
  "pinType": "analog",
  "pinCount": 1,
  "description": "Optional",
  "createdAt": "2026-03-11T12:00:00.000Z",
  "updatedAt": "2026-03-11T12:00:00.000Z"
}
```

Create body (`POST /api/parameters`):

```json
{
  "name": "Temperature",
  "variableType": "number",
  "pinType": "analog",
  "pinCount": 1,
  "description": "Optional"
}
```

Required fields: `name`, `variableType`, `pinType`

Default/coercion:

- `pinCount` defaults to `0` when missing or falsy in create.

Update body (`PUT /api/parameters/:id`): any subset of fields.

Other routes:

- `GET /api/parameters`
- `GET /api/parameters/:id`
- `DELETE /api/parameters/:id`

## 5.4 Item Types

Entity shape:

```json
{
  "id": 1,
  "name": "Sensor",
  "synonyms": "Detector",
  "vendorName": "Vendor A",
  "createdAt": "2026-03-11T12:00:00.000Z",
  "updatedAt": "2026-03-11T12:00:00.000Z"
}
```

Create body (`POST /api/item-types`):

```json
{
  "name": "Sensor",
  "synonyms": "Detector",
  "vendorName": "Vendor A"
}
```

Required fields: `name`

Update body (`PUT /api/item-types/:id`): any subset of fields.

Other routes:

- `GET /api/item-types`
- `GET /api/item-types/:id`
- `DELETE /api/item-types/:id`

## 5.5 Communications

Entity shape:

```json
{
  "id": 1,
  "name": "Comms A",
  "groupName": "Group 1",
  "protocol": "MQTT",
  "centric": "Device",
  "messageFormat": "JSON",
  "createdAt": "2026-03-11T12:00:00.000Z",
  "updatedAt": "2026-03-11T12:00:00.000Z"
}
```

Create body (`POST /api/communications`):

```json
{
  "name": "Comms A",
  "groupName": "Group 1",
  "protocol": "MQTT",
  "centric": "Device",
  "messageFormat": "JSON"
}
```

Required fields: `name`, `groupName`, `protocol`, `centric`, `messageFormat`

Update body (`PUT /api/communications/:id`): any subset of fields.

Other routes:

- `GET /api/communications`
- `GET /api/communications/:id`
- `DELETE /api/communications/:id`

## 5.6 Messages

Entity shape:

```json
{
  "id": 1,
  "name": "Status Msg",
  "itemType": "Sensor",
  "topic": "sensor/status",
  "messageType": "Event",
  "policyType": "AtLeastOnce",
  "retainMessages": false,
  "loggedMessage": false,
  "createdAt": "2026-03-11T12:00:00.000Z",
  "updatedAt": "2026-03-11T12:00:00.000Z"
}
```

Create body (`POST /api/messages`):

```json
{
  "name": "Status Msg",
  "itemType": "Sensor",
  "topic": "sensor/status",
  "messageType": "Event",
  "policyType": "AtLeastOnce",
  "retainMessages": true,
  "loggedMessage": false
}
```

Required fields: `name`, `itemType`, `topic`, `messageType`, `policyType`

Boolean coercion:

- Create: booleans are `true` only when value is exactly `true`, else `false`.
- Update: booleans use `Boolean(value)` coercion.

Update body (`PUT /api/messages/:id`): any subset of fields.

Other routes:

- `GET /api/messages`
- `GET /api/messages/:id`
- `DELETE /api/messages/:id`

## 5.7 Items

Entity shape:

```json
{
  "id": 1,
  "name": "Item A",
  "itemCode": "ITM-001",
  "itemTypeName": "Sensor",
  "vendorName": "Vendor A",
  "gateway": false,
  "secureItem": false,
  "createdAt": "2026-03-11T12:00:00.000Z",
  "updatedAt": "2026-03-11T12:00:00.000Z"
}
```

Create body (`POST /api/items`):

```json
{
  "name": "Item A",
  "itemCode": "ITM-001",
  "itemTypeName": "Sensor",
  "vendorName": "Vendor A",
  "gateway": true,
  "secureItem": false
}
```

Required fields: `name`, `itemCode`, `itemTypeName`, `vendorName`

Boolean coercion:

- Create: `gateway` and `secureItem` are `true` only when value is exactly `true`.
- Update: booleans use `Boolean(value)` coercion.

Update body (`PUT /api/items/:id`): any subset of fields.

Other routes:

- `GET /api/items`
- `GET /api/items/:id`
- `DELETE /api/items/:id`

## 5.8 Devices

Entity shape:

```json
{
  "id": 1,
  "name": "Device A",
  "serialNumber": "SN-001",
  "connectionType": "MQTT",
  "status": "provisioning",
  "description": "Optional",
  "createdAt": "2026-03-11T12:00:00.000Z",
  "updatedAt": "2026-03-11T12:00:00.000Z"
}
```

Create body (`POST /api/devices`):

```json
{
  "name": "Device A",
  "serialNumber": "SN-001",
  "connectionType": "MQTT",
  "status": "provisioning",
  "description": "Optional"
}
```

Required fields: `name`, `serialNumber`

Defaults:

- `connectionType`: `"MQTT"` if omitted.
- `status`: `"provisioning"` if omitted.

Update body (`PUT /api/devices/:id`): any subset of fields.

Other routes:

- `GET /api/devices`
- `GET /api/devices/:id`
- `DELETE /api/devices/:id`

## 6. Frontend Integration Notes

- There is no pagination, filtering, or search in list endpoints.
- There are no relational includes; resources are stored mostly as flat string references.
- No authentication token is required.
- Expect `createdAt`/`updatedAt` as ISO date strings.
- Plan for backend error inconsistencies (`400`, `401`, `404`, `500`) and always read `message`.
