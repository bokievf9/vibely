import type { LikesDictionary, SettingsDictionary } from './en'

export const settingsRu: SettingsDictionary = {
  title: 'Настройки',
  open: 'Настройки',
  notifications: 'Уведомления',
  notifyTypesHint: 'О чём уведомлять (когда push-уведомления включены).',
  notifyTypes: {
    new_matches: 'Новые мэтчи',
    messages: 'Сообщения',
    likes: 'Кто-то вас лайкнул',
    feed_replies: 'Ответы в ленте',
    random_reveal: 'Мэтчи на свиданиях вслепую',
    new_people: 'Новые люди рядом',
    calls: 'Входящие звонки',
  },
  privacy: 'Приватность',
  pause: 'Поставить профиль на паузу',
  pauseHint:
    'Вас не будет в «Знакомствах» и в «Кто вас лайкнул». Мэтчи и чаты сохранятся. Свидание вслепую подберёт вам пару, только если вы сами начнёте поиск.',
  blocked: 'Заблокированные',
  blockedEmpty: 'Вы никого не блокировали.',
  blockedEmptyHint: 'Когда вы заблокируете кого-то в чате или профиле, он появится здесь.',
  unblock: 'Разблокировать',
  unblockConfirm:
    'Разблокировать {name}? Вы снова сможете видеть друг друга. Удалённый мэтч не восстановится.',
  feedReplyPush: 'Новый ответ на ваш пост',
  feedReplyPushBody: 'Откройте ленту, чтобы прочитать.',
  account: 'Аккаунт',
}

export const likesRu: LikesDictionary = {
  title: 'Кто вас лайкнул',
  open: 'Кто вас лайкнул: {count}',
  hint: 'Вы им уже нравитесь. Лайкните в ответ, и сразу будет мэтч.',
  empty: 'Новых лайков пока нет',
  emptyHint: 'Когда кто-то вас лайкнет, он появится здесь. Продолжайте свайпать!',
  likeBack: 'Лайкнуть в ответ',
  pass: 'Пропустить',
  view: 'Открыть: {name}',
  lockedTitle: 'Вы нравитесь людям: {count}',
  lockedHint: 'Продолжайте свайпать: если лайкнете в ответ, будет мэтч.',
  pushTitle: 'Кто-то лайкнул вас в Vibely 💘',
  pushBody: 'Откройте Vibely, чтобы узнать кто.',
  pushBodyLocked: 'Продолжайте свайпать, возможно, это мэтч!',
}
