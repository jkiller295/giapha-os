"use client";

import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { ArrowLeft, Database, Settings, Terminal } from "lucide-react";
import Link from "next/link";

export default function MissingDBConfigPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#fafaf9] select-none selection:bg-amber-200 selection:text-amber-900 relative overflow-hidden">
      {/* Decorative background grid and blurs */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-size-[24px_24px] pointer-events-none"></div>
      <div className="absolute top-0 inset-x-0 h-screen overflow-hidden pointer-events-none flex justify-center">
        <div className="absolute top-[-10%] right-[-5%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-red-300/20 rounded-full blur-[100px] mix-blend-multiply" />
        <div className="absolute bottom-[0%] left-[-10%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] bg-amber-200/20 rounded-full blur-[120px] mix-blend-multiply" />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12 relative z-10 w-full">
        <motion.div
          className="max-w-2xl w-full bg-white p-8 sm:p-10 rounded-3xl shadow-xl border border-red-100 relative overflow-hidden"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-red-50 text-red-600 rounded-2xl">
              <Database className="size-8" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
                Chưa kết nối cơ sở dữ liệu
              </h2>
              <p className="text-stone-500 font-medium">
                Ứng dụng hiện chưa được cấu hình biến môi trường kết nối đến Supabase.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6">
              <h3 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
                <Settings className="size-5 text-stone-500" />
                Hướng dẫn khắc phục:
              </h3>

              <ol className="list-decimal list-inside space-y-4 text-stone-600">
                <li className="leading-relaxed">
                  Đăng nhập vào{" "}
                  <a
                    href="https://supabase.com/dashboard/project/_/settings/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-600 font-semibold hover:underline"
                  >
                    Supabase Dashboard
                  </a>
                  .
                </li>
                <li className="leading-relaxed">
                  Lấy thông tin <b>Project URL</b> và{" "}
                  <b>Project API Keys (anon public)</b>.
                </li>
                <li className="leading-relaxed">
                  Tạo file <code>.env.local</code> ở thư mục gốc của dự án.
                </li>
                <li className="leading-relaxed">
                  Thêm cấu hình sau vào file:
                  <div className="mt-3 bg-stone-900 text-stone-100 p-4 rounded-xl flex items-start gap-3 overflow-x-auto text-sm font-mono">
                    <Terminal className="size-5 text-stone-400 shrink-0 mt-0.5" />
                    <pre>
                      <code>
                        {`NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_supabase_anon_key`}
                      </code>
                    </pre>
                  </div>
                </li>
                <li className="leading-relaxed">
                  Khởi động lại server: <code>npm run dev</code> (hoặc bun dev).
                </li>
              </ol>
            </div>

            <div className="flex justify-center pt-2">
              <Link
                href="/"
                className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors shadow-sm"
              >
                Tải lại trang sau khi cấu hình
              </Link>
            </div>
          </div>
        </motion.div>
      </div>

      <Link
        href="/"
        className="absolute top-6 left-6 z-20 flex items-center gap-2 text-stone-500 hover:text-stone-900 font-semibold text-sm transition-all duration-300 bg-white/60 px-5 py-2.5 rounded-full shadow-sm border border-stone-200 hover:border-stone-300 hover:shadow-md"
      >
        <ArrowLeft className="size-4" />
        Trang chủ
      </Link>

      <Footer className="bg-transparent border-none mt-auto relative z-10" />
    </div>
  );
}
