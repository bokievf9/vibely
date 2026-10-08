import type { SanctionsDictionary, sanctionErrorsEn } from './en'

export const sanctionsRu: SanctionsDictionary = {
  bannedUntil: 'Блокировка закончится {date}.',
  bannedForever: 'Блокировка бессрочная.',
  appealTitle: 'Апелляция',
  appealHint:
    'Если вы считаете, что это ошибка, расскажите, что произошло. Модератор рассмотрит вашу апелляцию.',
  appealLabel: 'Ваша апелляция',
  appealPlaceholder: 'Опишите, что произошло (от 10 до 1000 символов)',
  appealSend: 'Отправить апелляцию',
  appealSent: 'Апелляция отправлена. Мы скоро её рассмотрим.',
  appealOpen: 'Ваша апелляция от {date} на рассмотрении.',
  appealRejected: 'Ваша последняя апелляция рассмотрена. Блокировка остаётся.',
  warningTitle: 'Предупреждение от модераторов',
  warningBody:
    'Ваш аккаунт получил предупреждение. Причина: {reason}. Повторные нарушения могут привести к запрету писать или блокировке.',
  warningUntil: 'Предупреждение действует до {date}.',
  warningOk: 'Понятно',
  mutedTitle: 'Сейчас вы не можете отправлять сообщения',
  mutedBody:
    'До {date} вы не можете отправлять сообщения в чатах и на свиданиях вслепую, публиковать посты и комментарии. Причина: {reason}.',
  mutedOk: 'Хорошо',
}

export const sanctionErrorsRu: typeof sanctionErrorsEn = {
  muted: 'Вы не можете отправлять сообщения, пока действует запрет.',
  appealOpen: 'У вас уже есть апелляция на рассмотрении.',
  appealTooShort: 'Напишите хотя бы 10 символов.',
  appealNotBanned: 'Ваш аккаунт не заблокирован.',
}
