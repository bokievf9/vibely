import { callsLegal } from './calls'
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
          'Aktiviti dalam aplikasi: suka dan langkau, padanan, mesej sembang, hantaran, komen dan suka dalam suapan, mesej sembang rawak, sekatan dan laporan.',
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
        heading: '3. Pengesahan swafoto',
        paragraphs: [
          'Setiap profil mesti lulus semakan swafoto. Swafoto anda hanya disemak oleh moderator manusia. Ia tidak pernah diterbitkan atau ditunjukkan kepada pengguna lain, dan fail foto dipadam selepas semakan. Kami hanya menyimpan keputusan (diluluskan atau ditolak, serta sebab penolakan).',
        ],
      },
      {
        heading: '4. Suapan tanpa nama',
        paragraphs: [
          'Pengguna lain tidak pernah melihat siapa yang menulis hantaran atau komen dalam suapan. Kami menyimpan maklumat penulis secara dalaman supaya anda boleh memadam hantaran sendiri dan supaya moderator boleh bertindak atas laporan (contohnya menyekat akaun yang menghantar kandungan kesat).',
        ],
      },
      {
        heading: '5. Sembang rawak',
        paragraphs: [
          'Sembang rawak adalah tanpa nama sehingga kedua-dua pihak bersetuju untuk mendedahkan profil. Mesej sembang rawak disimpan selama 30 hari dan kemudian dipadam secara automatik. Jika sesuatu sembang dilaporkan, ia disimpan selama yang diperlukan oleh moderator untuk mengendalikan laporan itu.',
        ],
      },
      // --- calls & recording (src/features/legal/content/calls.ts) ---
      callsLegal.ms.privacy,
      // --- end calls ---
      {
        heading: '6. Laporan, moderasi dan sekatan',
        paragraphs: [
          'Apabila anda melaporkan seseorang, moderator kami melihat kandungan yang dilaporkan beserta konteksnya (contohnya sembang berkenaan). Orang yang anda laporkan tidak diberitahu siapa yang melaporkannya. Moderator boleh menyembunyikan kandungan atau menyekat akaun, dan setiap keputusan direkodkan.',
          'Apabila anda menyekat seseorang, anda berdua tidak lagi dapat melihat satu sama lain dan padanan antara anda dibuang.',
        ],
      },
      {
        heading: '7. Siapa yang boleh melihat data anda',
        paragraphs: [
          'Pengguna lain yang disahkan boleh melihat profil, foto, umur dan jarak anggaran anda. Moderator boleh melihat apa yang diperlukan untuk menyemak pengesahan dan laporan.',
          'Kami menggunakan penyedia perkhidmatan yang dipercayai yang memproses data hanya mengikut arahan kami:',
        ],
        list: [
          'Supabase: pengehosan pangkalan data, log masuk dan storan fail.',
          'Twilio: penghantaran kod log masuk melalui SMS.',
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
          'Kami menyimpan data anda selagi akaun anda wujud. Swafoto pengesahan dipadam selepas semakan dan mesej sembang rawak selepas 30 hari (kecuali jika dilaporkan).',
          'Apabila anda memadam akaun, kami serta-merta memadam profil, foto, swafoto, padanan, mesej, hantaran, komen, suka, sekatan dan laporan yang anda buat. Laporan yang dibuat oleh orang lain tentang anda dan rekod moderasi mungkin disimpan untuk mencegah penyalahgunaan, contohnya supaya orang yang disekat tidak kembali. Sandaran ditimpa dalam tempoh yang terhad.',
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
      {
        heading: '6. Moderasi',
        paragraphs: [
          'Laporan disemak oleh manusia. Kami boleh menyembunyikan kandungan, mengehadkan ciri atau menyekat akaun yang melanggar Terma ini atau membahayakan orang lain, dengan atau tanpa notis. Jika anda rasa kami tersilap, hubungi kami.',
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
