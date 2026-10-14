import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorLine, NativeSelect } from "@/components/bits";
import { api } from "@/lib/api";
import { SEGMENTS } from "@shared/stages";

export function AddCompany({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", domain: "", phone: "", city: "Saskatoon", segment: "unknown" });
  const [error, setError] = useState<string | null>(null);
  const field = (k: keyof typeof f, label: string) => (
    <div className="grid gap-1"><Label htmlFor={`ac-${k}`}>{label}</Label><Input id={`ac-${k}`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );
  const save = async () => {
    setError(null);
    try { await api("/api/companies", { method: "POST", body: f }); setOpen(false); setF({ ...f, name: "", domain: "", phone: "" }); onAdded(); }
    catch (e) { setError((e as Error).message); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Add company</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>Add a company</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          {field("name", "Name")}{field("domain", "Website or domain")}{field("phone", "Phone")}{field("city", "City")}
          <div className="grid gap-1"><Label htmlFor="ac-seg">Segment</Label>
            <NativeSelect id="ac-seg" value={f.segment} onChange={(e) => setF({ ...f, segment: e.target.value })}>{SEGMENTS.map((s) => <option key={s}>{s}</option>)}</NativeSelect>
          </div>
          <ErrorLine error={error} />
        </div>
        <DialogFooter><Button onClick={save} disabled={!f.name.trim()}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
