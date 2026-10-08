import { z } from 'zod'
import { CALL_KINDS } from './types'

export const startCallSchema = z.object({ matchId: z.uuid(), kind: z.enum(CALL_KINDS) })
export const callIdSchema = z.uuid()
export const callPermissionSchema = z.object({ matchId: z.uuid(), allowed: z.boolean() })
