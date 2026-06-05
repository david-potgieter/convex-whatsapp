import { httpRouter } from 'convex/server'

// Component HTTP routes (webhook) are mounted via httpPrefix in convex.config.ts.
// Add any app-specific HTTP routes here.
const http = httpRouter()

export default http
