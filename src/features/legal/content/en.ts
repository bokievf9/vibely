import type { LegalContent } from './types'

// Draft for review by a Malaysian lawyer before launch (see ./index.ts).
export const en: LegalContent = {
  privacy: {
    description: 'How Vibely collects, uses and protects your personal data under the PDPA 2010.',
    intro:
      'Vibely ("we", "us") is a dating app for adults in Malaysia, available at vibelydate.com. This policy explains, in plain language, what personal data we collect, why, who can see it and how you can control it, in line with the Personal Data Protection Act 2010 (PDPA).',
    sections: [
      {
        heading: '1. Data we collect',
        paragraphs: ['We only collect what the app needs to work and to keep people safe:'],
        list: [
          'Phone number: used to sign you in with an SMS code. It is stored by our sign-in provider and is never shown to other users.',
          'Profile: your name, date of birth (others only see your age), gender, who you are interested in, city, bio and interests.',
          'Optional profile details, only if you add them: what you are looking for, height, job, education, languages, smoking, drinking, pets, children, answers to profile prompts and religion. Religion is sensitive personal data: it is entirely optional, shown only on your profile and never used for matching, ranking, ads or anything else. You can remove any of these details at any time.',
          'Photos you upload to your profile.',
          'Approximate location: if you allow it, your device location is used to calculate how far you are from other users. Your exact location is never shown to anyone. Others only see a rounded distance, such as "5 km away".',
          'Verification selfie: a photo of you doing a gesture, used only to confirm that you match your profile photos (see section 3).',
          'Activity in the app: likes and passes, matches, chat messages (text, photos, voice messages and video messages), audio and video calls (recorded, see section 3), posts, comments and likes in the feed, random chat messages, blocks and reports.',
          'Technical data: cookies that keep you signed in and remember your language. We do not use advertising trackers.',
        ],
      },
      {
        heading: '2. How we use your data',
        paragraphs: [
          'We use your data to run the service (show your profile, suggest people nearby, create matches and deliver messages), to keep the community safe (verification, moderation, removing fake or underage accounts, enforcing our Terms of Use), to make sure Vibely is used only in Malaysia (we accept Malaysian mobile numbers only) and to send you sign-in codes by SMS.',
          'We do not sell your personal data and we do not show ads.',
        ],
      },
      {
        heading: '3. Safety recording and selfie verification',
        paragraphs: [
          'To keep people safe, everything that happens in Vibely is recorded and stored: chat messages, photos, voice and video messages, random chats, feed content and all audio and video calls (calls are recorded on our servers, and you always see a "This call is recorded" notice during a call). We never record anything without telling you.',
          'These recordings are kept for up to 90 days and then deleted automatically. Material connected to an open report or moderation case is kept until that case is resolved. Recordings are stored privately and are never shown to other users. Only our moderators can open them, only while handling a report, and every access is logged.',
          'Every profile must pass a selfie check. Your selfie is reviewed by a human moderator only and is never published or shown to other users. The selfie file is kept for up to 90 days (so moderators can check it if the account is reported) and then deleted automatically; we keep the result (approved or rejected, and the reason for a rejection).',
        ],
      },
      {
        heading: '4. Anonymous feed',
        paragraphs: [
          'Other users never see who wrote a post or a comment in the feed. We do store the author internally, so that you can delete your own posts and so that moderators can act on reports (for example, block an account that posts abuse).',
        ],
      },
      {
        heading: '5. Random chat',
        paragraphs: [
          'Random chats are anonymous until both people agree to reveal their profiles. Random chat messages are kept for 90 days and then deleted automatically. If a chat is reported, it is kept until the report is resolved.',
        ],
      },
      {
        heading: '6. Reports, moderation and blocking',
        paragraphs: [
          'When you report someone, our moderators see the reported content and its context (for example, the chat in question). The person you report is not told who reported them. Moderators may hide content or block accounts, and every decision is recorded.',
          'When you block someone, you stop seeing each other and any match between you is removed.',
        ],
      },
      {
        heading: '7. Who can see your data',
        paragraphs: [
          'Other verified users can see your profile, photos, age and approximate distance. Moderators can see what they need to review verifications and reports; recorded messages, media and calls only while handling a report (see section 3).',
          'We use trusted service providers who process data only on our instructions:',
        ],
        list: [
          'Supabase: database, sign-in and file storage hosting.',
          'Twilio: sending SMS sign-in codes.',
        ],
      },
      {
        heading: '8. Data outside Malaysia',
        paragraphs: [
          'Our service providers may store or process data on servers outside Malaysia. We choose providers that protect personal data to a standard comparable to the PDPA. We disclose data to authorities only when Malaysian law requires it.',
        ],
      },
      {
        heading: '9. How long we keep data',
        paragraphs: [
          'We keep your data while your account exists, except for safety recordings: photos, voice and video messages sent in chats, call recordings, verification selfies and random chat messages are deleted automatically after 90 days, unless they are part of an open report. A chat photo, voice or video message that has expired is shown as "expired".',
          'When you delete your account, we immediately delete your profile, photos, selfies, matches, messages, posts, comments, likes, blocks and the reports you made. Reports other people made about you and moderation records may be kept to prevent abuse, for example to stop a banned person from returning. Backups are overwritten within a limited period.',
        ],
      },
      {
        heading: '10. Your rights',
        paragraphs: ['Under the PDPA you can:'],
        list: [
          'access the personal data we hold about you;',
          'correct it (you can edit your profile at any time);',
          'withdraw your consent and delete your account at any time in Profile → Delete account;',
          'ask us questions or make a request by email. We reply within 21 days.',
        ],
      },
      {
        heading: '11. Security',
        paragraphs: [
          'We use encrypted connections (HTTPS), strict database access rules, private file storage and short-lived links to photos. No system is perfectly secure, so please keep your phone and SIM card safe.',
        ],
      },
      {
        heading: '12. Adults only',
        paragraphs: [
          'Vibely is only for people aged 18 or older. If we learn that an account belongs to someone under 18, we delete it. Please report any profile you think belongs to a minor.',
        ],
      },
      {
        heading: '13. Changes to this policy',
        paragraphs: [
          'If we change this policy, we will update the date at the top of this page and tell you in the app about important changes.',
        ],
      },
    ],
  },
  terms: {
    description: 'The rules for using Vibely, a dating app for adults in Malaysia.',
    intro:
      'These Terms of Use are an agreement between you and Vibely. By creating an account you confirm that you have read and accept them, together with our Privacy Policy.',
    sections: [
      {
        heading: '1. Who can use Vibely',
        paragraphs: ['You may use Vibely only if:'],
        list: [
          'you are at least 18 years old;',
          'you live in Malaysia and sign up with your own Malaysian mobile number;',
          'you have not been banned from Vibely before;',
          'you have only one account.',
        ],
      },
      {
        heading: '2. Your account',
        paragraphs: [
          'Give true information about yourself and use only photos of you. Every profile must pass a selfie check before it can use the app. You are responsible for what happens in your account, so keep your phone secure.',
        ],
      },
      {
        heading: '3. Rules of conduct',
        paragraphs: ['Treat other people with respect. You must not:'],
        list: [
          'harass, threaten, bully or insult anyone, or post hate speech;',
          'post nudity, sexual content or violent content;',
          'create fake profiles or pretend to be someone else;',
          'send spam or ads, ask for money, or try to scam anyone;',
          'offer or ask for paid sexual services;',
          'post anything involving minors in a sexual way, or anything else illegal under Malaysian law;',
          "share other people's personal data, photos or private messages without their permission.",
        ],
      },
      {
        heading: '4. Your content',
        paragraphs: [
          'You own the photos, texts and messages you post. You allow us to store and show them to other users only to run Vibely. You are responsible for your content, including anonymous posts in the feed.',
        ],
      },
      {
        heading: '5. Staying safe',
        paragraphs: [
          'Selfie checks reduce fake profiles, but we cannot guarantee who someone is or how they will behave. Meet new people in public places, tell a friend where you are going and never send money to someone you met online. Use Report and Block whenever something feels wrong.',
        ],
      },
      {
        heading: '6. Moderation',
        paragraphs: [
          'Reports are reviewed by people. We may hide content, limit features or ban accounts that break these Terms or put others at risk, with or without notice. If you think we made a mistake, contact us.',
          "For everyone's safety, messages, photos, voice and video messages and audio and video calls are recorded and stored for up to 90 days (longer only while a report about them is open). Only moderators handling a report can access them. See the Privacy Policy, section 3.",
        ],
      },
      {
        heading: '7. Deleting your account',
        paragraphs: [
          'You can delete your account at any time in Profile → Delete account. Deletion is permanent and cannot be undone. See the Privacy Policy for what happens to your data.',
        ],
      },
      {
        heading: '8. The service',
        paragraphs: [
          'Vibely is provided "as is". We work to keep it available and secure, but we may change, pause or stop features. We do not promise that you will find a match.',
        ],
      },
      {
        heading: '9. Liability',
        paragraphs: [
          'To the extent permitted by Malaysian law, we are not responsible for how other users behave, on or off the app, or for indirect losses. Nothing in these Terms limits rights you have under Malaysian law that cannot be excluded, including under the Consumer Protection Act 1999.',
        ],
      },
      {
        heading: '10. Law',
        paragraphs: [
          'These Terms are governed by the laws of Malaysia, and the courts of Malaysia have jurisdiction over any dispute.',
        ],
      },
      {
        heading: '11. Changes to these Terms',
        paragraphs: [
          'We may update these Terms. We will change the date at the top of this page and tell you in the app about important changes. If you keep using Vibely after that, you accept the new Terms.',
        ],
      },
    ],
  },
}
