'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { accountDeletionBlockers } from '@/lib/account-deletion';
import { fail, failFrom, isUniqueViolation, ok, parseForm } from '@/lib/action-helpers';
import { logAudit } from '@/lib/audit';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/session';
import { addressSchema, createUserSchema, profileSchema, shippingRateSchema, updateUserSchema } from '@/lib/validations';
import type { ActionResponse } from '@/types';

// ───────────────────────── Profil & alamat (customer) ─────────────────────────

export async function updateProfileAction(formData: FormData): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('shop.buy');
  if (denied) return denied;

  const { data, invalid } = parseForm(profileSchema, formData);
  if (invalid) return invalid;

  await prisma.user.update({ where: { id: user.id }, data: { name: data.name, phone: data.phone ?? null } });
  revalidatePath('/', 'layout');
  return ok('Profil disimpan.');
}

export async function createAddressAction(formData: FormData): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('shop.buy');
  if (denied) return denied;

  const { data, invalid } = parseForm(addressSchema, formData);
  if (invalid) return invalid;

  try {
    const isFirst = (await prisma.address.count({ where: { userId: user.id } })) === 0;
    await prisma.address.create({ data: { ...data, userId: user.id, isDefault: isFirst } });
  } catch (error) {
    return failFrom(error, 'Alamat belum bisa disimpan.');
  }

  revalidatePath('/account');
  revalidatePath('/checkout');
  return ok('Alamat disimpan.');
}

export async function setDefaultAddressAction(addressId: string): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('shop.buy');
  if (denied) return denied;

  const address = await prisma.address.findFirst({ where: { id: addressId, userId: user.id } });
  if (!address) return fail('Alamat tidak ditemukan.');

  await prisma.$transaction([
    prisma.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } }),
    prisma.address.update({ where: { id: address.id }, data: { isDefault: true } }),
  ]);
  revalidatePath('/account');
  revalidatePath('/checkout');
  return ok();
}

export async function deleteAddressAction(addressId: string): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('shop.buy');
  if (denied) return denied;

  // Order lama menyimpan salinan alamatnya sendiri, jadi aman dihapus.
  await prisma.address.deleteMany({ where: { id: addressId, userId: user.id } });
  revalidatePath('/account');
  revalidatePath('/checkout');
  return ok();
}

// ───────────────────────── Kelola akun (admin) ─────────────────────────

export async function createUserAction(formData: FormData): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('user.manage');
  if (denied) return denied;

  const { data, invalid } = parseForm(createUserSchema, formData);
  if (invalid) return invalid;

  try {
    await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone ?? null,
          role: data.role,
          passwordHash: await bcrypt.hash(data.password, 10),
        },
      });
      await logAudit(tx, {
        actorId: user.id,
        action: 'user.create',
        entity: 'User',
        entityId: created.id,
        after: { email: created.email, role: created.role },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, message: 'Email ini sudah dipakai akun lain.', error: { email: ['Email sudah terdaftar'] } };
    }
    return failFrom(error, 'Akun belum bisa dibuat.');
  }

  revalidatePath('/dashboard/users');
  return ok(`Akun ${data.email} dibuat.`);
}

export async function updateUserAction(formData: FormData): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('user.manage');
  if (denied) return denied;

  const { data, invalid } = parseForm(updateUserSchema, formData);
  if (invalid) return invalid;

  const target = await prisma.user.findUnique({ where: { id: data.id } });
  if (!target) return fail('Akun tidak ditemukan.');

  // Admin tidak boleh mengunci dirinya sendiri, dan toko harus selalu punya admin aktif.
  const losesAdmin = target.role === 'ADMIN' && target.isActive && (data.role !== 'ADMIN' || !data.isActive);
  if (losesAdmin) {
    if (target.id === user.id) return fail('Kamu tidak bisa menonaktifkan atau menurunkan role akunmu sendiri.');
    const otherAdmins = await prisma.user.count({ where: { role: 'ADMIN', isActive: true, id: { not: target.id } } });
    if (otherAdmins === 0) return fail('Ini satu-satunya admin aktif. Buat admin lain dulu.');
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone ?? null,
          role: data.role,
          isActive: data.isActive,
          // Kata sandi diganti admin: sesi akun itu di semua perangkat ikut keluar.
          ...(data.password && { passwordHash: await bcrypt.hash(data.password, 10), sessionVersion: { increment: 1 } }),
        },
      });
      await logAudit(tx, {
        actorId: user.id,
        action: 'user.update',
        entity: 'User',
        entityId: target.id,
        before: { email: target.email, role: target.role, isActive: target.isActive },
        after: { email: data.email, role: data.role, isActive: data.isActive, passwordChanged: Boolean(data.password) },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, message: 'Email ini sudah dipakai akun lain.', error: { email: ['Email sudah terdaftar'] } };
    }
    return failFrom(error, 'Perubahan akun belum bisa disimpan.');
  }

  revalidatePath('/dashboard/users', 'layout');
  return ok('Perubahan akun disimpan.');
}

export async function deleteUserAction(userId: string): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('user.manage');
  if (denied) return denied;

  if (userId === user.id) return fail('Kamu tidak bisa menghapus akunmu sendiri.');
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return fail('Akun tidak ditemukan. Mungkin sudah dihapus.');
  const blockers = await accountDeletionBlockers(userId);
  if (blockers.length > 0) {
    return fail(`Akun ini punya ${blockers.join(', ')}, jadi tidak bisa dihapus tanpa merusak riwayat. Nonaktifkan saja supaya tidak bisa login.`);
  }
  if (target.role === 'ADMIN') {
    const otherAdmins = await prisma.user.count({ where: { role: 'ADMIN', isActive: true, id: { not: target.id } } });
    if (otherAdmins === 0) return fail('Ini satu-satunya admin aktif. Buat admin lain dulu.');
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.delete({ where: { id: userId } });
      await logAudit(tx, {
        actorId: user.id,
        action: 'user.delete',
        entity: 'User',
        entityId: userId,
        before: { email: target.email, role: target.role },
      });
    });
  } catch (error) {
    return failFrom(error, 'Akun belum bisa dihapus.');
  }

  revalidatePath('/dashboard/users', 'layout');
  // Halaman akun ini sudah tidak ada; kembali ke daftar dengan kabar berhasil.
  redirect(`/dashboard/users?dihapus=${encodeURIComponent(target.email)}`);
}

// ───────────────────────── Ongkir (admin) ─────────────────────────

export async function saveShippingRateAction(formData: FormData): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('shipping.manage');
  if (denied) return denied;

  const { data, invalid } = parseForm(shippingRateSchema, formData);
  if (invalid) return invalid;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.shippingRate.findFirst({ where: { province: { equals: data.province, mode: 'insensitive' } } });
      if (existing) {
        await tx.shippingRate.update({ where: { id: existing.id }, data: { cost: data.cost } });
      } else {
        await tx.shippingRate.create({ data });
      }
      await logAudit(tx, {
        actorId: user.id,
        action: 'shipping.update',
        entity: 'ShippingRate',
        before: existing ? { province: existing.province, cost: existing.cost } : undefined,
        after: { province: data.province, cost: data.cost },
      });
    });
  } catch (error) {
    return failFrom(error, 'Ongkir belum bisa disimpan.');
  }

  revalidatePath('/dashboard/shipping');
  revalidatePath('/checkout');
  return ok(`Ongkir ke ${data.province} disimpan.`);
}

export async function deleteShippingRateAction(rateId: string): Promise<ActionResponse> {
  const { user, denied } = await requirePermission('shipping.manage');
  if (denied) return denied;

  const rate = await prisma.shippingRate.findUnique({ where: { id: rateId } });
  if (!rate) return fail('Ongkir tidak ditemukan.');

  await prisma.$transaction(async (tx) => {
    await tx.shippingRate.delete({ where: { id: rateId } });
    await logAudit(tx, {
      actorId: user.id,
      action: 'shipping.delete',
      entity: 'ShippingRate',
      before: { province: rate.province, cost: rate.cost },
    });
  });

  revalidatePath('/dashboard/shipping');
  revalidatePath('/checkout');
  return ok();
}
