import { createAddressAction } from '@/actions/account.actions';
import { ActionForm, SubmitButton } from '@/components/ui/ActionForm';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';

/** Form tambah alamat. Provinsi dibatasi ke wilayah yang ongkirnya sudah diatur toko. */
export function AddressForm({ provinces, defaultRecipient }: { provinces: string[]; defaultRecipient?: string }) {
  if (provinces.length === 0) {
    return <p className="text-sm text-asphalt-500">Toko belum mengatur wilayah pengiriman, jadi alamat belum bisa ditambahkan.</p>;
  }

  return (
    <ActionForm action={createAddressAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
      <TextField label="Label alamat" name="label" defaultValue="Rumah" required hint="Misal: Rumah, Kantor." />
      <TextField label="Nama penerima" name="recipient" defaultValue={defaultRecipient} autoComplete="name" required />
      <TextField label="Nomor HP penerima" name="phone" type="tel" autoComplete="tel" required />
      <TextField label="Kode pos" name="postalCode" inputMode="numeric" maxLength={5} autoComplete="postal-code" required />
      <TextAreaField
        label="Alamat lengkap"
        name="street"
        rows={2}
        autoComplete="street-address"
        required
        hint="Nama jalan, nomor rumah, RT/RW, kelurahan, kecamatan."
        wrapperClassName="sm:col-span-2"
      />
      <TextField label="Kota atau kabupaten" name="city" autoComplete="address-level2" required />
      <SelectField label="Provinsi" name="province" defaultValue="" required>
        <option value="" disabled>
          Pilih provinsi
        </option>
        {provinces.map((province) => (
          <option key={province} value={province}>
            {province}
          </option>
        ))}
      </SelectField>
      <div className="sm:col-span-2">
        <SubmitButton variant="secondary" pendingLabel="Menyimpan…">
          Simpan alamat
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
