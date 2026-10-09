import { callsLegal } from './calls'
import { nearbyLegal } from './nearby'
import { matchmakerLegal } from './matchmaker'
import { crushLegal } from './crush'
import { duoLegal } from './duo'
import { conversationsLegal } from './conversations'
import { statusesLegal } from './statuses'
import { plansLegal } from './plans'
import type { LegalContent } from './types'

// Draft for review by a Malaysian lawyer before launch (see ./index.ts).
export const ms: LegalContent = {
  privacy: {
    description:
      'Cara Vibely mengumpul, menggunakan dan melindungi data peribadi anda di bawah PDPA 2010.',
    intro:
      'Vibely ("kami") ialah aplikasi temu janji untuk orang dewasa di Malaysia, di vibelydate.com. Dasar ini menerangkan dengan bahasa mudah data peribadi yang kami kumpul, sebabnya, siapa yang boleh melihatnya dan cara anda mengawalnya, selaras dengan Akta Perlindungan Data Peribadi 2010 (PDPA).',
    sections: [
      {
        heading: '1. Data yang kami kumpul',
        paragraphs: [
          'Kami hanya mengumpul data yang diperlukan untuk aplikasi berfungsi dan untuk keselamatan pengguna:',
        ],
        list: [
          'Nombor telefon: untuk log masuk dengan kod SMS. Ia disimpan oleh penyedia log masuk kami dan tidak pernah ditunjukkan kepada pengguna lain.',
          'Profil: nama, tarikh lahir (orang lain hanya melihat umur anda), jantina, siapa yang anda minati, bandar, bio dan minat.',
          'Butiran profil pilihan, hanya jika anda menambahnya: apa yang anda cari, ketinggian, pekerjaan, pendidikan, bahasa, merokok, minum alkohol, haiwan peliharaan, anak, jawapan kepada soalan profil dan agama. Agama ialah data peribadi sensitif: ia sepenuhnya pilihan, hanya dipaparkan pada profil anda dan tidak pernah digunakan untuk padanan, susunan, iklan atau apa-apa tujuan lain. Anda boleh membuang butiran ini pada bila-bila masa.',
          'Foto yang anda muat naik ke profil.',
          'Lokasi anggaran: jika anda benarkan, lokasi peranti anda digunakan untuk mengira jarak anda dengan pengguna lain. Lokasi tepat anda tidak pernah ditunjukkan kepada sesiapa. Orang lain hanya melihat jarak yang dibundarkan, contohnya "5 km dari sini".',
          'Swafoto pengesahan: foto anda membuat isyarat tangan, hanya untuk memastikan anda sepadan dengan foto profil (lihat seksyen 3).',
          'Aktiviti dalam aplikasi: suka dan langkau, padanan, mesej sembang (teks, foto, mesej suara dan mesej video), panggilan audio dan video (dirakam, lihat seksyen 3), hantaran, komen dan suka dalam suapan, mesej dan keputusan temu janji buta (Sambung atau Langkau), sekatan dan laporan.',
          'Data teknikal: kuki yang mengekalkan log masuk dan mengingati bahasa anda. Kami tidak menggunakan penjejak iklan.',
        ],
      },
      {
        heading: '2. Cara kami menggunakan data anda',
        paragraphs: [
          'Kami menggunakan data anda untuk menjalankan perkhidmatan (memaparkan profil, mencadangkan orang berdekatan, mewujudkan padanan dan menghantar mesej), menjaga keselamatan komuniti (pengesahan, moderasi, membuang akaun palsu atau bawah umur, menguatkuasakan Terma Penggunaan), memastikan Vibely hanya digunakan di Malaysia (kami hanya menerima nombor mudah alih Malaysia) dan menghantar kod log masuk melalui SMS.',
          'Kami tidak menjual data peribadi anda dan tidak memaparkan iklan.',
        ],
      },
      {
        heading: '3. Rakaman keselamatan dan pengesahan swafoto',
        paragraphs: [
          'Untuk memastikan semua orang selamat, semua yang berlaku dalam Vibely dirakam dan disimpan: mesej sembang, foto, mesej suara dan video, temu janji buta, kandungan suapan dan semua panggilan audio dan video (panggilan dirakam di pelayan kami, dan anda sentiasa melihat notis "Panggilan ini dirakam" semasa panggilan). Kami tidak pernah merakam apa-apa tanpa memberitahu anda.',
          'Rakaman ini disimpan sehingga 90 hari dan kemudian dipadam secara automatik. Bahan yang berkaitan dengan laporan atau kes moderasi yang masih terbuka disimpan sehingga kes itu selesai. Rakaman disimpan secara peribadi dan tidak pernah ditunjukkan kepada pengguna lain. Hanya moderator kami boleh membukanya, hanya semasa mengendalikan laporan, dan setiap akses direkodkan.',
          'Setiap profil mesti lulus semakan swafoto. Swafoto anda hanya disemak oleh moderator manusia dan tidak pernah diterbitkan atau ditunjukkan kepada pengguna lain. Fail swafoto disimpan sehingga 90 hari (supaya moderator boleh menyemaknya jika akaun dilaporkan) dan kemudian dipadam secara automatik; kami menyimpan keputusan (diluluskan atau ditolak, serta sebab penolakan).',
          'Swafoto pengesahan anda, bersama sehingga 3 foto profil anda, mungkin disemak oleh moderator kami melalui saluran moderasi peribadi di Telegram, dan foto ini dipadam daripada saluran tersebut selepas semakan atau selewat-lewatnya dalam masa 2 hari.',
        ],
      },
      {
        heading: '4. Suapan',
        paragraphs: [
          'Setiap hantaran dan komen dalam suapan adalah tanpa nama kecuali anda memilih "Diri saya". Kandungan tanpa nama hanya menunjukkan nama samaran rawak untuk bebenang itu (contohnya "Durian Ungu"); pengguna lain tidak pernah melihat siapa penulisnya. Dengan "Diri saya", pengguna lain yang disahkan melihat nama, umur, foto utama dan lencana pengesahan anda, dan boleh membuka kad profil ringkas untuk dibaca sahaja (tidak pernah lokasi anda). Orang lain mungkin melihat bahawa hantaran datang dari bandar mereka, tetapi tidak pernah bandar yang mana.',
          'Kami menyimpan penulis setiap hantaran dan komen secara dalaman supaya anda boleh memadam kandungan sendiri dan supaya moderator boleh bertindak atas laporan (contohnya menyekat akaun yang menghantar kandungan kesat). Hantaran dan komen suapan dipadam secara automatik selepas 90 hari, kecuali jika ia sebahagian daripada laporan yang masih dibuka.',
        ],
      },
      {
        heading: '5. Temu janji buta',
        paragraphs: [
          'Dalam temu janji buta anda bersembang dengan orang lain yang disahkan tanpa melihat satu sama lain: setiap seorang hanya ditunjukkan sebagai nama samaran (contohnya "Pasangan #402") dengan gambar abstrak. Foto, nama, umur dan profil anda tidak dihantar kepada orang itu melainkan kedua-dua anda menekan Sambung. Minat bersama mungkin ditunjukkan sebagai petunjuk. Jika salah seorang menekan Langkau, sembang tamat untuk kedua-dua pihak; orang yang satu lagi hanya melihat bahawa ia telah tamat.',
          'Mesej temu janji buta disimpan selama 90 hari dan kemudian dipadam secara automatik. Jika temu janji buta dilaporkan, ia disimpan sehingga laporan itu selesai. Apabila kedua-dua anda menekan Sambung, anda menjadi padanan, profil anda ditunjukkan kepada satu sama lain dan mesej temu janji buta disalin ke dalam sembang biasa anda dengan orang itu, di mana ia disimpan seperti mesej sembang lain.',
        ],
      },
      // --- calls & recording (src/features/legal/content/calls.ts) ---
      callsLegal.ms.privacy,
      // --- end calls ---
      // --- crossed paths (src/features/legal/content/nearby.ts) ---
      nearbyLegal.ms.privacy,
      // --- end crossed paths ---
      // --- secret crush (src/features/legal/content/crush.ts) ---
      crushLegal.ms.privacy,
      // --- end secret crush ---
      // --- private replies & question of the day (src/features/legal/content/conversations.ts) ---
      conversationsLegal.ms.privacy,
      // --- end private replies & question of the day ---
      // --- matchmaker & incognito (src/features/legal/content/matchmaker.ts) ---
      matchmakerLegal.ms.privacy,
      // --- end matchmaker & incognito ---
      // --- duo dating (src/features/legal/content/duo.ts) ---
      duoLegal.ms.privacy,
      // --- end duo dating ---
      // --- live statuses (src/features/legal/content/statuses.ts) ---
      statusesLegal.ms.privacy,
      // --- end live statuses ---
      // --- Plus and VIP plans (src/features/legal/content/plans.ts) ---
      plansLegal.ms.privacy,
      // --- end Plus and VIP plans ---
      {
        heading: '6. Laporan, moderasi dan sekatan',
        paragraphs: [
          'Apabila anda melaporkan seseorang, moderator kami melihat kandungan yang dilaporkan beserta konteksnya (contohnya sembang berkenaan). Orang yang anda laporkan tidak diberitahu siapa yang melaporkannya. Moderator boleh menyembunyikan kandungan atau menyekat akaun, dan setiap keputusan direkodkan.',
          'Apabila anda menyekat seseorang, anda berdua tidak lagi dapat melihat satu sama lain dan padanan antara anda dibuang.',
          'Sistem kami menyemak mesej sembang dan temu janji buta secara automatik untuk tanda penipuan atau hubungan yang tidak selamat (contohnya nombor telefon, pautan ke aplikasi mesej lain atau permintaan wang). Ini tidak pernah menyekat atau mengubah mesej anda. Ia hanya menandakannya supaya moderator boleh menyemak, dan tanda tersebut dipadam selepas 90 hari.',
          'Jika anda melanggar peraturan kami, kami boleh memberi amaran, menghalang anda daripada menghantar mesej dan hantaran untuk sementara, mengehadkan siapa yang boleh melihat kandungan anda, atau menggantung atau menyekat akaun anda. Kami menyimpan rekod keputusan ini dan sebabnya. Jika akaun anda digantung atau disekat, anda boleh membuat rayuan dalam aplikasi dan moderator akan menyemaknya.',
          'Setiap kali moderator membuka swafoto, nombor telefon, perbualan, media atau rakaman panggilan, tindakan itu direkodkan. Jika anda membatalkan padanan atau menyekat seseorang semasa laporan antara anda masih terbuka, perbualan itu disimpan untuk moderator sehingga laporan diselesaikan.',
        ],
      },
      {
        heading: '7. Siapa yang boleh melihat data anda',
        paragraphs: [
          'Pengguna lain yang disahkan boleh melihat profil, foto, umur dan jarak anggaran anda. Moderator boleh melihat apa yang diperlukan untuk menyemak pengesahan dan laporan; mesej, media dan panggilan yang dirakam hanya semasa mengendalikan laporan (lihat seksyen 3).',
          'Kami menggunakan penyedia perkhidmatan yang dipercayai yang memproses data hanya mengikut arahan kami:',
        ],
        list: [
          'Supabase: pengehosan pangkalan data, log masuk dan storan fail.',
          'Twilio: penghantaran kod log masuk melalui SMS.',
          'DigitalOcean: pelayan aplikasi dan storan rakaman panggilan.',
          'Telegram: saluran peribadi yang digunakan oleh moderator kami untuk menyemak swafoto pengesahan (lihat seksyen 3).',
        ],
      },
      {
        heading: '8. Data di luar Malaysia',
        paragraphs: [
          'Penyedia perkhidmatan kami mungkin menyimpan atau memproses data pada pelayan di luar Malaysia. Kami memilih penyedia yang melindungi data peribadi pada tahap yang setanding dengan PDPA. Kami hanya mendedahkan data kepada pihak berkuasa apabila dikehendaki oleh undang-undang Malaysia.',
        ],
      },
      {
        heading: '9. Tempoh penyimpanan data',
        paragraphs: [
          'Kami menyimpan data anda selagi akaun anda wujud, kecuali rakaman keselamatan: foto, mesej suara dan video yang dihantar dalam sembang, rakaman panggilan, swafoto pengesahan dan mesej temu janji buta dipadam secara automatik selepas 90 hari, kecuali jika ia sebahagian daripada laporan yang masih terbuka. Foto, mesej suara atau video sembang yang telah tamat tempoh ditunjukkan sebagai "tamat tempoh".',
          'Apabila anda memadam akaun, kami serta-merta memadam profil, foto, swafoto, padanan, mesej, hantaran, komen, suka, sekatan dan laporan yang anda buat. Laporan yang dibuat oleh orang lain tentang anda dan rekod moderasi mungkin disimpan untuk mencegah penyalahgunaan, contohnya supaya orang yang disekat tidak kembali. Sandaran ditimpa dalam tempoh yang terhad.',
          'Kami mungkin menyimpan data tertentu lebih lama daripada 90 hari apabila ia diperlukan untuk menangani isu keselamatan yang serius, tuntutan undang-undang atau permintaan pihak berkuasa Malaysia. Dalam keadaan itu, data disimpan hanya selama yang perlu dan setiap akses kepadanya direkodkan.',
        ],
      },
      {
        heading: '10. Hak anda',
        paragraphs: ['Di bawah PDPA anda boleh:'],
        list: [
          'mengakses data peribadi yang kami simpan tentang anda;',
          'membetulkannya (anda boleh mengedit profil pada bila-bila masa);',
          'menarik balik persetujuan dan memadam akaun pada bila-bila masa di Profil → Padam akaun;',
          'bertanya atau membuat permintaan melalui e-mel. Kami membalas dalam masa 21 hari.',
        ],
      },
      {
        heading: '11. Keselamatan',
        paragraphs: [
          'Kami menggunakan sambungan disulitkan (HTTPS), peraturan akses pangkalan data yang ketat, storan fail peribadi dan pautan foto jangka pendek. Tiada sistem yang selamat sepenuhnya, jadi sila jaga telefon dan kad SIM anda.',
        ],
      },
      {
        heading: '12. Dewasa sahaja',
        paragraphs: [
          'Vibely hanya untuk mereka yang berumur 18 tahun ke atas. Jika kami mendapati sesuatu akaun milik seseorang di bawah 18 tahun, kami akan memadamnya. Sila laporkan mana-mana profil yang anda rasa milik kanak-kanak.',
        ],
      },
      {
        heading: '13. Perubahan pada dasar ini',
        paragraphs: [
          'Jika kami mengubah dasar ini, kami akan mengemas kini tarikh di bahagian atas halaman ini dan memaklumkan perubahan penting dalam aplikasi.',
        ],
      },
    ],
  },
  terms: {
    description: 'Peraturan penggunaan Vibely, aplikasi temu janji untuk orang dewasa di Malaysia.',
    intro:
      'Terma Penggunaan ini ialah perjanjian antara anda dan Vibely. Dengan membuat akaun, anda mengesahkan bahawa anda telah membaca dan menerimanya bersama Dasar Privasi kami.',
    sections: [
      {
        heading: '1. Siapa yang boleh menggunakan Vibely',
        paragraphs: ['Anda hanya boleh menggunakan Vibely jika:'],
        list: [
          'anda berumur sekurang-kurangnya 18 tahun;',
          'anda tinggal di Malaysia dan mendaftar dengan nombor mudah alih Malaysia anda sendiri;',
          'anda tidak pernah disekat daripada Vibely sebelum ini;',
          'anda hanya mempunyai satu akaun.',
        ],
      },
      {
        heading: '2. Akaun anda',
        paragraphs: [
          'Berikan maklumat yang benar tentang diri anda dan gunakan foto anda sendiri sahaja. Setiap profil mesti lulus semakan swafoto sebelum boleh menggunakan aplikasi. Anda bertanggungjawab atas apa yang berlaku dalam akaun anda, jadi pastikan telefon anda selamat.',
        ],
      },
      {
        heading: '3. Peraturan tingkah laku',
        paragraphs: ['Hormati orang lain. Anda tidak boleh:'],
        list: [
          'mengganggu, mengugut, membuli atau menghina sesiapa, atau menyiarkan ucapan kebencian;',
          'menyiarkan kebogelan, kandungan seksual atau kandungan ganas;',
          'membuat profil palsu atau menyamar sebagai orang lain;',
          'menghantar spam atau iklan, meminta wang atau cuba menipu sesiapa;',
          'menawarkan atau meminta perkhidmatan seks berbayar;',
          'menyiarkan apa-apa yang melibatkan kanak-kanak secara seksual, atau apa-apa lagi yang menyalahi undang-undang Malaysia;',
          'berkongsi data peribadi, foto atau mesej peribadi orang lain tanpa kebenaran mereka.',
        ],
      },
      {
        heading: '4. Kandungan anda',
        paragraphs: [
          'Anda memiliki foto, teks dan mesej yang anda siarkan. Anda membenarkan kami menyimpan dan menunjukkannya kepada pengguna lain semata-mata untuk menjalankan Vibely. Anda bertanggungjawab atas kandungan anda, termasuk hantaran tanpa nama dalam suapan.',
        ],
      },
      {
        heading: '5. Kekal selamat',
        paragraphs: [
          'Semakan swafoto mengurangkan profil palsu, tetapi kami tidak dapat menjamin identiti atau tingkah laku seseorang. Berjumpa orang baharu di tempat awam, beritahu rakan ke mana anda pergi dan jangan sekali-kali menghantar wang kepada orang yang anda kenali dalam talian. Gunakan Lapor dan Sekat apabila sesuatu terasa tidak kena.',
        ],
      },
      // --- calls & recording (src/features/legal/content/calls.ts) ---
      callsLegal.ms.terms,
      // --- end calls ---
      // --- private replies & question of the day (src/features/legal/content/conversations.ts) ---
      conversationsLegal.ms.terms,
      // --- end private replies & question of the day ---
      // --- live statuses (src/features/legal/content/statuses.ts) ---
      statusesLegal.ms.terms,
      // --- end live statuses ---
      // --- duo dating (src/features/legal/content/duo.ts) ---
      duoLegal.ms.terms,
      // --- end duo dating ---
      // --- Plus and VIP plans (src/features/legal/content/plans.ts) ---
      plansLegal.ms.terms,
      // --- end Plus and VIP plans ---
      {
        heading: '6. Moderasi',
        paragraphs: [
          'Laporan disemak oleh manusia. Jika anda melanggar Terma ini atau membahayakan orang lain, kami boleh menyembunyikan kandungan anda, memberi amaran, menghalang anda daripada menghantar mesej dan hantaran untuk sementara, mengehadkan siapa yang boleh melihat kandungan anda, atau menggantung akaun anda untuk satu tempoh atau menyekatnya secara kekal. Pelanggaran serius (contohnya apa-apa yang melibatkan kanak-kanak, ugutan atau penipuan) boleh menyebabkan sekatan kekal serta-merta.',
          'Jika akaun anda digantung atau disekat, anda boleh membuat rayuan daripada skrin yang anda lihat semasa log masuk. Moderator menyemak setiap rayuan dan anda akan melihat keputusannya dalam aplikasi. Anda juga boleh menghubungi kami melalui e-mel.',
          'Kami boleh menyimpan maklumat yang berkaitan dengan laporan dan berkongsinya dengan pihak berkuasa Malaysia apabila dikehendaki oleh undang-undang.',
          'Demi keselamatan semua, mesej, foto, mesej suara dan video serta panggilan audio dan video dirakam dan disimpan sehingga 90 hari (lebih lama hanya semasa laporan mengenainya masih terbuka). Hanya moderator yang mengendalikan laporan boleh mengaksesnya. Lihat Dasar Privasi, seksyen 3.',
        ],
      },
      {
        heading: '7. Memadam akaun anda',
        paragraphs: [
          'Anda boleh memadam akaun pada bila-bila masa di Profil → Padam akaun. Pemadaman adalah kekal dan tidak boleh dibatalkan. Lihat Dasar Privasi untuk mengetahui apa yang berlaku kepada data anda.',
        ],
      },
      {
        heading: '8. Perkhidmatan',
        paragraphs: [
          'Vibely disediakan "seadanya". Kami berusaha memastikan ia sentiasa tersedia dan selamat, tetapi kami boleh mengubah, menjeda atau menghentikan ciri. Kami tidak menjanjikan anda akan menemui padanan.',
          'Kod promo dan VIP: kami mungkin mengedarkan kod promo (contohnya di acara atau melalui rakan kongsi) yang membuka pelan Plus atau VIP untuk tempoh terhad (lihat bahagian 5e). Sesetengah kod terhad bilangannya, sah sehingga tarikh tertentu, dikhaskan untuk kumpulan tertentu (contohnya jantina yang disahkan melalui semakan swafoto) atau memerlukan swafoto yang diluluskan. Ciri adalah peribadi, tidak boleh dipindahkan atau ditukar dengan wang, dan kami boleh membatalkannya serta menyekat kod tersebut jika ia dikongsi, dijual semula atau digunakan untuk melanggar Syarat ini.',
        ],
      },
      {
        heading: '9. Liabiliti',
        paragraphs: [
          'Setakat yang dibenarkan oleh undang-undang Malaysia, kami tidak bertanggungjawab atas tingkah laku pengguna lain, di dalam atau di luar aplikasi, atau atas kerugian tidak langsung. Tiada apa-apa dalam Terma ini mengehadkan hak anda di bawah undang-undang Malaysia yang tidak boleh dikecualikan, termasuk di bawah Akta Pelindungan Pengguna 1999.',
        ],
      },
      {
        heading: '10. Undang-undang',
        paragraphs: [
          'Terma ini tertakluk kepada undang-undang Malaysia, dan mahkamah Malaysia mempunyai bidang kuasa ke atas sebarang pertikaian.',
        ],
      },
      {
        heading: '11. Perubahan pada Terma ini',
        paragraphs: [
          'Kami boleh mengemas kini Terma ini. Kami akan menukar tarikh di bahagian atas halaman ini dan memaklumkan perubahan penting dalam aplikasi. Jika anda terus menggunakan Vibely selepas itu, anda menerima Terma yang baharu.',
        ],
      },
    ],
  },
}
