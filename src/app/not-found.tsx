import Link from "next/link";

export default function NotFound() {
  return (
    <section className="rounded-3xl bg-white p-8 text-center shadow-sm">
      <h1 className="text-4xl font-black">Lesson not found</h1>
      <p className="mt-3 text-slate-600">
        This lesson does not exist in the current learning path.
      </p>
      <Link
        href="/lessons"
        className="mt-6 inline-flex rounded-xl bg-slate-950 px-5 py-3 font-black text-white"
      >
        Back to lessons
      </Link>
    </section>
  );
}
