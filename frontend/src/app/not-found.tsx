import { BaseErrorView } from "@/src/components/common/BaseErrorView";

/** 404 global — dirender di dalam root layout (di luar konteks locale). */
export default function NotFound() {
  return (
    <BaseErrorView
      statusCode={404}
      title="Halaman Tidak Ditemukan"
      description="Halaman yang Anda cari mungkin telah dipindahkan, dihapus, atau tidak pernah ada di sistem Street Lamp Predictive Maintenance."
      goBackText="Kembali"
      goHomeText="Ke Beranda"
    />
  );
}
