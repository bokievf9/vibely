export type LegalSection = {
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
