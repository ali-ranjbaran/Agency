import { PHONE, formatPhone } from "@/lib/content";

export function PhoneLink({ className = "link font-bold" }: { className?: string }) {
  return <a href={`tel:${PHONE}`} className={className}>{formatPhone(PHONE)}</a>;
}
