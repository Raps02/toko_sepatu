export interface ActionResponse {
  success: boolean;
  message?: string;
  error?: Record<string, string[] | undefined>;
  /**
   * Hanya di development saat email belum disetel (BREVO_API_KEY kosong): link yang
   * seharusnya dikirim lewat email, ditampilkan ActionForm supaya alurnya tetap bisa dicoba.
   */
  devLink?: string;
}

/** Bentuk action yang bisa dipasang langsung ke <ActionForm>. */
export type FormAction = (formData: FormData) => Promise<ActionResponse>;

/** Hasil action unduh invoice: isi PDF dikirim sebagai base64 lalu disimpan browser. */
export type InvoiceDownloadResponse =
  | { success: true; filename: string; base64: string }
  | { success: false; message: string };
