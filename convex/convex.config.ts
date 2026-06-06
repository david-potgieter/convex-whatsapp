import { defineApp } from 'convex/server'
import { v } from 'convex/values'
import whatsapp from '../convex.config.js'

const app = defineApp({
  env: {
    WHATSAPP_PHONE_NUMBER_ID: v.string(),
    WHATSAPP_ACCESS_TOKEN: v.string(),
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: v.string(),
    WHATSAPP_APP_SECRET: v.string(),
    WHATSAPP_WABA_ID: v.optional(v.string()),
  },
})

// Webhook URL: https://<your-convex-site-url>/whatsapp/webhook
app.use(whatsapp, {
  httpPrefix: '/whatsapp',
  env: {
    WHATSAPP_PHONE_NUMBER_ID: app.env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_ACCESS_TOKEN: app.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: app.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    WHATSAPP_APP_SECRET: app.env.WHATSAPP_APP_SECRET,
    WHATSAPP_WABA_ID: app.env.WHATSAPP_WABA_ID,
  },
})

export default app
