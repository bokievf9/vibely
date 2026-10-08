import { z } from 'zod'

// PushSubscription.toJSON() from the browser. Limits mirror the push_subscriptions checks.
export const subscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
})

export const endpointSchema = subscriptionSchema.shape.endpoint

export type SubscriptionInput = z.input<typeof subscriptionSchema>
