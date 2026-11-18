// Nama dan identitas toko. Ganti di sini, berlaku di seluruh website.
export const SITE = {
  name: "Langkah Kaki",
  tagline: "Sepatu untuk setiap langkah",
  description:
    "Toko sepatu online Langkah Kaki: lari, kasual, futsal, dan formal dengan stok per ukuran yang selalu terbaru.",
} as const;

// Data toko yang dicetak di invoice. Isi yang ada; baris kosong tidak dicetak.
export const STORE_CONTACT: { address: string; phone: string; email: string } =
  {
    // Alamat contoh, ganti dengan alamat toko yang sebenarnya.
    address:
      "Jl. Kemang Raya No. 27, Bangka, Mampang Prapatan, Jakarta Selatan 12730",
    phone: "",
    email: "",
  };
