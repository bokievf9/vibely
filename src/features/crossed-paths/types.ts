export type CrossedPerson = {
  id: string
  name: string
  age: number
  photo: { url: string; width: number; height: number } | null
  crossings: number
  // Day granularity only: today or yesterday (Malaysia time). Never a time.
  today: boolean
  // Neighbourhood name from our own list, else only the city, else nothing ("nearby").
  area: string | null
  city: string | null
}
