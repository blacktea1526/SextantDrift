# Order Service API Contract

### POST /api/v1/orders
- [method] POST /api/v1/orders
- [param] amount: number (required)
- [param] currency: string (required)
- [status] 201 (Created)
- [status] 400 (Bad Request)
- [status] 409 (Conflict)

### GET /api/v1/orders/:id
- [method] GET /api/v1/orders/:id
- [param] id: string (required)
- [status] 200 (OK)
- [status] 404 (Not Found)
