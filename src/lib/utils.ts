import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function ageFromBirthDate(birthDate: string, now = new Date()): number {
  const born = new Date(birthDate)
  const age = now.getFullYear() - born.getFullYear()
  const hadBirthday =
    now.getMonth() > born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() >= born.getDate())
  return hadBirthday ? age : age - 1
}
