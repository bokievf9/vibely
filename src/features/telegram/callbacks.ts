import 'server-only'
import {
  BAN_LABELS,
  REJECTION_LABELS,
  UNDERAGE_REJECTION_LABEL,
  underageBanText,
} from '@/features/admin/labels'
import { notifyNewPeople } from '@/features/push/notify-new-people'
import {
  BAN_CODES,
  REJECTION_CODES,
  type BanCode,
  type RejectionCode,
} from '@/features/safety/reason-codes'
import { answerCallback, editKeyboard, editText } from './client'
import {
  banConfirmKeyboard,
  banReasonKeyboard,
  rejectKeyboard,
  selfieKeyboard,
  underageConfirmKeyboard,
} from './keyboards'
import {
  deciderLabel,
  rejectUnderageAs,
  resolveReportGroupAs,
  reviewSelfieAs,
  setBanAs,
  type LinkedAdmin,
  type Outcome,
} from './moderation'
import type { CallbackAction, TgChat, TgUser } from './protocol'
import { closeReport, handleOf, postBanChange, reportView } from './reports'
import { closeSelfie } from './selfies'

type Ctx = {
  callbackId: string
  chat: TgChat
  messageId: number
  from: TgUser
  admin: LinkedAdmin
}

const isRejection = (c: string): c is RejectionCode => REJECTION_CODES.includes(c as RejectionCode)
const isBan = (c: string): c is BanCode => BAN_CODES.includes(c as BanCode)

const time = () =>
  new Date().toLocaleTimeString('ru-RU', {
    timeZone: 'Asia/Kuala_Lumpur',
    hour: '2-digit',
    minute: '2-digit',
  })

// Second click on an already decided item: a notice for that moderator only.
async function settle(ctx: Ctx, outcome: Outcome, done: string): Promise<boolean> {
  if (outcome.ok) {
    await answerCallback(ctx.callbackId, done)
    return true
  }
  await answerCallback(ctx.callbackId, outcome.message, true)
  return false
}

export async function runCallback(action: CallbackAction, ctx: Ctx) {
  const who = deciderLabel(ctx.admin, ctx.from)
  switch (action.a) {
    case 'selfie_approve': {
      const r = await reviewSelfieAs(ctx.admin.adminId, action.id, true)
      if (await settle(ctx, r, 'Одобрено')) {
        await closeSelfie(action.id, `📸 Селфи\n✅ Одобрено: ${who}, ${time()}`)
        if (r.userId) notifyNewPeople(r.userId)
      } else if (!r.ok && r.already) {
        await closeSelfie(action.id, `📸 Селфи\n${r.message}`)
      }
      return
    }
    case 'selfie_reject_menu':
      await editKeyboard(ctx.chat.id, ctx.messageId, rejectKeyboard(action.id))
      return answerCallback(ctx.callbackId, 'Выберите причину')
    case 'selfie_back':
      await editKeyboard(ctx.chat.id, ctx.messageId, selfieKeyboard(action.id))
      return answerCallback(ctx.callbackId)
    case 'selfie_reject': {
      if (!isRejection(action.code))
        return answerCallback(ctx.callbackId, 'Неизвестная причина', true)
      const r = await reviewSelfieAs(ctx.admin.adminId, action.id, false, action.code)
      if (await settle(ctx, r, 'Отклонено')) {
        await closeSelfie(
          action.id,
          `📸 Селфи\n❌ Отклонено (${REJECTION_LABELS[action.code]}): ${who}, ${time()}`,
        )
      } else if (!r.ok && r.already) {
        await closeSelfie(action.id, `📸 Селфи\n${r.message}`)
      }
      return
    }
    case 'selfie_underage_confirm':
      await editKeyboard(ctx.chat.id, ctx.messageId, underageConfirmKeyboard(action.id))
      return answerCallback(
        ctx.callbackId,
        'Селфи будет отклонено, аккаунт заблокирован (модератор: 7 дн., админ: бессрочно) и скрыт',
      )
    case 'selfie_underage': {
      const r = await rejectUnderageAs(ctx.admin.adminId, action.id)
      if (await settle(ctx, r, 'Отклонено и заблокировано')) {
        await closeSelfie(
          action.id,
          `📸 Селфи\n🔞 ${UNDERAGE_REJECTION_LABEL} — отклонено и ${underageBanText(r.ok ? (r.banDays ?? null) : null)}: ${who}, ${time()}`,
        )
        if (r.ok && r.userId) {
          await postBanChange({
            moderator: who,
            userId: r.userId,
            banned: true,
            reason: 'underage',
          })
        }
      } else if (!r.ok && r.already) {
        await closeSelfie(action.id, `📸 Селфи\n${r.message}`)
      }
      return
    }

    case 'report_dismiss': {
      const r = await resolveReportGroupAs(ctx.admin.adminId, {
        decision: 'dismiss',
        targetType: action.t,
        targetId: action.id,
      })
      if (await settle(ctx, r, 'Жалобы отклонены')) {
        await closeReport(action.t, action.id, `Отклонено: нарушения нет. ${who}, ${time()}`)
      } else if (!r.ok && r.already) {
        await closeReport(action.t, action.id, r.message)
      }
      return
    }
    case 'report_hide': {
      if (action.t !== 'post' && action.t !== 'comment') {
        return answerCallback(ctx.callbackId, 'Скрыть можно только пост или комментарий', true)
      }
      const view = await reportView(action.t, action.id)
      const r = await resolveReportGroupAs(ctx.admin.adminId, {
        decision: 'hide',
        targetType: action.t,
        targetId: action.id,
        reason: `Скрыто через Telegram: ${view?.summary.latest_reason ?? 'жалоба'}`,
      })
      if (await settle(ctx, r, 'Скрыто')) {
        await closeReport(action.t, action.id, `🙈 Скрыто: ${who}, ${time()}`)
      } else if (!r.ok && r.already) {
        await closeReport(action.t, action.id, r.message)
      }
      return
    }
    case 'report_ban_menu':
      await editKeyboard(ctx.chat.id, ctx.messageId, banReasonKeyboard(action.t, action.id))
      return answerCallback(ctx.callbackId, 'Выберите причину бана')
    case 'report_back': {
      const view = await reportView(action.t, action.id)
      if (view) await editText(ctx.chat.id, ctx.messageId, view.text, view.keyboard)
      return answerCallback(ctx.callbackId)
    }
    case 'report_ban_confirm': {
      if (!isBan(action.code)) return answerCallback(ctx.callbackId, 'Неизвестная причина', true)
      const view = await reportView(action.t, action.id)
      if (!view?.summary.offender_id) return answerCallback(ctx.callbackId, 'Некого банить', true)
      await editText(
        ctx.chat.id,
        ctx.messageId,
        `${view.text}\n\nЗаблокировать ${await handleOf(view.summary.offender_id)}?\nПричина: ${BAN_LABELS[action.code]}`,
        banConfirmKeyboard(action.t, action.id, action.code),
      )
      return answerCallback(ctx.callbackId)
    }
    case 'report_ban': {
      if (!isBan(action.code)) return answerCallback(ctx.callbackId, 'Неизвестная причина', true)
      const view = await reportView(action.t, action.id)
      const offenderId = view?.summary.offender_id
      if (!offenderId) return answerCallback(ctx.callbackId, 'Некого банить', true)
      const r = await resolveReportGroupAs(ctx.admin.adminId, {
        decision: 'ban',
        targetType: action.t,
        targetId: action.id,
        offenderId,
        reason: action.code,
      })
      if (await settle(ctx, r, 'Заблокирован')) {
        await closeReport(
          action.t,
          action.id,
          `🔨 ${await handleOf(offenderId, false)} заблокирован (${BAN_LABELS[action.code]}): ${who}, ${time()}`,
        )
        await postBanChange({
          moderator: who,
          userId: offenderId,
          banned: true,
          reason: action.code,
        })
      } else if (!r.ok && r.already) {
        await closeReport(action.t, action.id, r.message)
      }
      return
    }

    case 'user_ban': {
      if (!isBan(action.code)) return answerCallback(ctx.callbackId, 'Неизвестная причина', true)
      const r = await setBanAs(ctx.admin.adminId, action.id, true, action.code)
      if (await settle(ctx, r, 'Заблокирован')) {
        await editText(
          ctx.chat.id,
          ctx.messageId,
          `🔨 ${await handleOf(action.id, false)} заблокирован (${BAN_LABELS[action.code]}).`,
        )
        await postBanChange({
          moderator: who,
          userId: action.id,
          banned: true,
          reason: action.code,
        })
      } else {
        await editText(ctx.chat.id, ctx.messageId, r.ok ? '' : r.message)
      }
      return
    }
    case 'user_unban': {
      const r = await setBanAs(ctx.admin.adminId, action.id, false)
      if (await settle(ctx, r, 'Разблокирован')) {
        await editText(
          ctx.chat.id,
          ctx.messageId,
          `♻️ ${await handleOf(action.id, false)} разблокирован.`,
        )
        await postBanChange({ moderator: who, userId: action.id, banned: false })
      } else {
        await editText(ctx.chat.id, ctx.messageId, r.ok ? '' : r.message)
      }
      return
    }
    case 'cancel':
      await editText(ctx.chat.id, ctx.messageId, 'Отменено.')
      return answerCallback(ctx.callbackId)
  }
}
