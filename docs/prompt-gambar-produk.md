# Prompt Gemini untuk foto produk

Foto produk lama (mis. `kota-low-putih.jpg`, `aero-run-2-hitam.jpg`) punya gaya yang sama:
satu sepatu kanan, tampak samping penuh, ujung menghadap ke **kiri**, latar studio abu-abu
muda polos, bayangan lembut di bawah sol, persegi 1024×1024. Prompt di bawah meniru gaya itu.

## Cara pakai

1. Tempel **gaya dasar** + **deskripsi produk** ke Gemini sebagai satu prompt.
2. Kalau hasilnya ada tulisan/logo, minta ulang: "hapus semua logo dan tulisan".
3. Simpan sebagai JPG 1024×1024 dengan nama file **persis** seperti di tabel, ke
   `public/images/products/`.
4. Jalankan `npm run db:seed`. Seed cuma memasang gambar yang file-nya sudah ada, jadi
   bisa dicicil. Nama file harus memuat nama warna (mis. `-hitam`) supaya foto ikut
   berganti saat pembeli memilih warna.

Tips: upload salah satu foto lama ke Gemini sebagai referensi lalu tambahkan
"samakan pencahayaan, latar, sudut kamera, dan posisi sepatu dengan foto referensi ini".

## Gaya dasar (tempel di awal setiap prompt)

```
Professional e-commerce product photo, square 1:1, 1024x1024. A single right shoe shown
in perfect side profile, toe pointing to the LEFT, centered horizontally and sitting
slightly below the vertical center, occupying about 65% of the frame width. Seamless
light cool-grey studio background (#C9CBCE to #D5D7DA gradient, slightly lighter at top),
soft diffused overhead lighting, a soft natural contact shadow under the sole. Photorealistic,
sharp focus, true-to-life materials. No people, no props, no text, no logos, no brand marks,
no watermark.
```

## Deskripsi per produk

| File | Deskripsi produk (tempel setelah gaya dasar) |
| --- | --- |
| `aero-run-2-wanita-lavender.jpg` | Women's daily running shoe, slim feminine last, soft lavender engineered mesh upper with small ventilation holes, lavender TPU overlays around the midfoot, thick white cushioned foam midsole with diagonal sculpted grooves, light grey rubber outsole, lavender laces, pull tab at the heel. |
| `aero-run-2-wanita-putih.jpg` | Same women's running shoe as above but with a white engineered mesh upper, pale pink accents on the overlays and heel pull tab, white laces, thick white sculpted foam midsole, light grey outsole. |
| `kota-platform-putih.jpg` | Women's low-top canvas platform sneaker, off-white cotton canvas upper, white rounded rubber toe cap, 5 white metal eyelets, white flat laces tied neatly, very thick flat white rubber platform sole about 4 cm tall with a thin tan stripe at the bottom edge. |
| `kota-platform-krem.jpg` | Same women's low-top canvas platform sneaker, warm cream / beige canvas upper, white rubber toe cap, cream laces, thick white platform sole with thin tan stripe. |
| `senja-flat-hitam.jpg` | Women's ballet flat shoe, smooth soft black synthetic leather, rounded almond toe, low-cut topline, a small flat black bow on the vamp, thin flat black rubber sole with a tiny 1 cm heel, light grey interior lining visible. |
| `senja-flat-nude.jpg` | Same women's ballet flat, nude / light tan beige smooth synthetic leather, small matching bow on the vamp, thin tan rubber sole, cream interior lining visible. |
| `anggun-block-heel-hitam.jpg` | Women's office pump with a 5 cm block heel, glossy black smooth leather, slim pointed toe, closed back, low elegant topline, sturdy rectangular block heel in black, thin black leather sole, beige interior lining visible. |
| `anggun-block-heel-merah-marun.jpg` | Same women's 5 cm block heel office pump, deep maroon / burgundy smooth leather, slim pointed toe, maroon block heel, thin dark sole, beige interior lining. |

## Kalau mau nambah produk lain

Pakai gaya dasar yang sama, ganti deskripsinya. Nama file: `<slug-nama-produk>-<slug-warna>.jpg`
(huruf kecil, spasi jadi `-`), lalu daftarkan di `PRODUCTS` di `prisma/seed.ts` atau
unggah lewat Dashboard → Produk → Foto Produk.
