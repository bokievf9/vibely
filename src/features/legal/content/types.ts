export type LegalSection = {
  // Optional anchor (#id), for links from other pages (the landing form links #waitlist).
  id?: string
  heading: string
  paragraphs: string[]
  list?: string[]
}

export type LegalDocument = {
  description: string
  intro: string
  sections: LegalSection[]
}

export type LegalContent = {
  privacy: LegalDocument
  terms: LegalDocument
}

export type LegalDocumentId = keyof LegalContent
