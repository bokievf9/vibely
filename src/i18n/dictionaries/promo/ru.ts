import type { promoEn, promoErrorsEn } from './en'

export const promoRu: typeof promoEn = {
  section: 'Промокод',
  row: 'Ввести промокод',
  rowHint: 'Коды с мероприятий, из студенческих групп и от партнёров открывают Plus или VIP.',
  vipUntil: 'VIP до {date}',
  boostUntil: 'Показ первым в Discover до {date}',
  pendingHint: 'Бонусы включатся, как только одобрят ваше селфи.',
  haveCode: 'Есть промокод?',
  optional: 'Необязательно',
  title: 'Промокод',
  label: 'Код',
  placeholder: 'например, XMUM2026',
  intro: 'Введите код так, как вы его получили. Регистр букв не важен.',
  apply: 'Применить',
  grantedTitle: 'Промокод применён',
  pendingTitle: 'Код принят',
  pendingBody: 'Код {code} закреплён за вами. Бонусы включатся, как только одобрят ваше селфи.',
  grantedBody: 'Код {code} применён. Вот что вы получаете:',
  perkPlanDate: '{plan} до {date}',
  perkPlanDays: '{plan} на {days} дн.',
  perkBoostDate: 'Ваш профиль показывается первым в Discover до {date}',
  perkBoostHours: 'Ваш профиль показывается первым в Discover в течение {hours} ч',
  nonTransferable: 'Бонусы личные и не передаются. См. Условия использования.',
  done: 'Готово',
  badge: 'VIP',
}

export const promoErrorsRu: typeof promoErrorsEn = {
  promoInvalid: 'Такого кода нет. Проверьте написание.',
  promoExpired: 'Срок действия кода истёк.',
  promoUsedUp: 'Этот код уже полностью использован.',
  promoNotForYou: 'Этот код недоступен для вашего профиля.',
  promoAlreadyRedeemed: 'Вы уже использовали этот код.',
  promoTooManyAttempts: 'Слишком много попыток. Попробуйте через час.',
  promoFormat: 'Только буквы, цифры, _ и - (от 3 до 32 символов).',
}
