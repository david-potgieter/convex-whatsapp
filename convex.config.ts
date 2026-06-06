import { defineComponent } from 'convex/server'
import { v } from 'convex/values'
import webhookReceiver from 'convex-webhook-receiver/convex.config'

const component = defineComponent('whatsapp', {
  env: {
    WHATSAPP_PHONE_NUMBER_ID: v.string(),
    WHATSAPP_ACCESS_TOKEN: v.string(),
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: v.string(),
    WHATSAPP_APP_SECRET: v.string(),
    WHATSAPP_WABA_ID: v.optional(v.string()),
  },
})

component.use(webhookReceiver)

export default component
