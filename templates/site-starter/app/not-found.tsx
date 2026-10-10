import { PrimaryCta } from "@/components/PrimaryCta";

export default function NotFound() {
  return (
    <main id="main" className="gutter mx-auto max-w-page pb-20 pt-12">
      <h1 className="text-display font-extrabold">That page isn't here</h1>
      <p className="mt-5 text-lead"><a href="/" className="link">Go to the home page</a>, or:</p>
      <div className="mt-6"><PrimaryCta /></div>
    </main>
  );
}
