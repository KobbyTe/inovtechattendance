import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Cohort, Student } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { generateStudentId, previewStudentId } from "@/lib/cohorts";

const YEARS = ["Year 1", "Year 2", "Year 3", "Year 4"];

export function RosterTab() {
  const [students, setStudents] = useState<Student[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [cohortFilter, setCohortFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    year_level: "Year 1",
    cohort_id: "",
    guardian_name: "",
    guardian_email: "",
    student_email: "",
  });
  const [busy, setBusy] = useState(false);

  async function load() {
    const [{ data: ss }, { data: att }, { data: cs }] = await Promise.all([
      supabase.from("students").select("*").order("student_id"),
      supabase.from("attendance").select("student_id"),
      supabase.from("cohorts").select("*").order("name"),
    ]);
    setStudents((ss ?? []) as Student[]);
    setCohorts((cs ?? []) as Cohort[]);
    const c: Record<string, number> = {};
    for (const r of att ?? []) c[r.student_id] = (c[r.student_id] ?? 0) + 1;
    setCounts(c);
  }
  useEffect(() => {
    load();
  }, []);

  const cohortById = new Map(cohorts.map((c) => [c.id, c]));
  const selectedCohort = form.cohort_id ? cohortById.get(form.cohort_id) : undefined;
  const idPreview = selectedCohort && form.full_name
    ? previewStudentId(selectedCohort.code, form.full_name)
    : null;

  async function addStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cohort_id) return toast.error("Please choose a cohort");
    const cohort = cohortById.get(form.cohort_id);
    if (!cohort) return toast.error("Cohort not found");
    setBusy(true);
    try {
      const student_id = await generateStudentId(cohort.code, cohort.id, form.full_name);
      const { error } = await supabase.from("students").insert({
        student_id,
        full_name: form.full_name,
        year_level: form.year_level,
        cohort_id: form.cohort_id,
        guardian_name: form.guardian_name || null,
        guardian_email: form.guardian_email || null,
        student_email: form.student_email || null,
      });
      if (error) {
        toast.error(
          error.code === "23505" ? "A student with that ID already exists" : error.message
        );
        return;
      }
      toast.success(`Student added — ${student_id}`);
      setOpen(false);
      setForm({
        full_name: "",
        year_level: "Year 1",
        cohort_id: "",
        guardian_name: "",
        guardian_email: "",
        student_email: "",
      });
      load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Student removed");
    load();
  }

  const filtered = students.filter((s) => {
    const matchesQuery =
      s.full_name.toLowerCase().includes(q.toLowerCase()) ||
      s.student_id.toLowerCase().includes(q.toLowerCase());
    const matchesCohort = cohortFilter === "all" || s.cohort_id === cohortFilter;
    return matchesQuery && matchesCohort;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or ID…"
            className="pl-9 h-11"
          />
        </div>
        <Select value={cohortFilter} onValueChange={setCohortFilter}>
          <SelectTrigger className="h-11 sm:w-48">
            <SelectValue placeholder="All cohorts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cohorts</SelectItem>
            {cohorts.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button className="h-11">
              <Plus className="mr-1 h-4 w-4" /> Add student
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Add a student</SheetTitle>
            </SheetHeader>
            <form onSubmit={addStudent} className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cohort</Label>
                <Select
                  value={form.cohort_id}
                  onValueChange={(v) => setForm({ ...form, cohort_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose cohort" />
                  </SelectTrigger>
                  <SelectContent>
                    {cohorts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {idPreview && (
                <div className="rounded-md bg-muted px-3 py-2">
                  <p className="text-xs text-muted-foreground">Auto-generated ID</p>
                  <p className="font-mono font-semibold text-sm">{idPreview}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Final sequence number is assigned on save.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Year level</Label>
                <Select
                  value={form.year_level}
                  onValueChange={(v) => setForm({ ...form, year_level: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Guardian / Parent name</Label>
                <Input
                  value={form.guardian_name}
                  onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Guardian / Parent email</Label>
                <Input
                  type="email"
                  value={form.guardian_email}
                  onChange={(e) => setForm({ ...form, guardian_email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Student email (optional)</Label>
                <Input
                  type="email"
                  value={form.student_email}
                  onChange={(e) => setForm({ ...form, student_email: e.target.value })}
                />
              </div>
              <Button type="submit" disabled={busy} className="w-full h-11">
                {busy ? "Adding…" : "Add student"}
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      <div className="rounded-xl bg-card border border-border overflow-hidden">
        {/* Desktop table */}
        <table className="hidden md:table w-full text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">ID</th>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Cohort</th>
              <th className="px-4 py-2 text-left">Year</th>
              <th className="px-4 py-2 text-left">Sessions</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const c = s.cohort_id ? cohortById.get(s.cohort_id) : undefined;
              return (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs">{s.student_id}</td>
                  <td className="px-4 py-2">{s.full_name}</td>
                  <td className="px-4 py-2">
                    {c ? <CohortBadge cohort={c} /> : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="px-4 py-2">{s.year_level}</td>
                  <td className="px-4 py-2">{counts[s.student_id] ?? 0}</td>
                  <td className="px-4 py-2 text-right">
                    <DeleteBtn onConfirm={() => remove(s.id)} name={s.full_name} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {/* Mobile cards */}
        <ul className="md:hidden divide-y divide-border">
          {filtered.map((s) => {
            const c = s.cohort_id ? cohortById.get(s.cohort_id) : undefined;
            return (
              <li key={s.id} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{s.full_name}</p>
                    {c && <CohortBadge cohort={c} />}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    {s.student_id} · {s.year_level} · {counts[s.student_id] ?? 0} sessions
                  </p>
                </div>
                <DeleteBtn onConfirm={() => remove(s.id)} name={s.full_name} />
              </li>
            );
          })}
        </ul>
        {filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No students found.
          </div>
        )}
      </div>
    </div>
  );
}

export function CohortBadge({ cohort }: { cohort: Cohort }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{
        background: `${cohort.color}1F`,
        color: cohort.color,
        border: `1px solid ${cohort.color}40`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: cohort.color }} />
      {cohort.name}
    </span>
  );
}

function DeleteBtn({ onConfirm, name }: { onConfirm: () => void; name: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will also remove all attendance records for this student.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Remove</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
    setBusy(false);
    if (error) {
      toast.error(
        error.code === "23505" ? "That student ID already exists" : error.message
      );
      return;
    }
    toast.success("Student added");
    setOpen(false);
    setForm({ student_id: "", full_name: "", year_level: "Year 1" });
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Student removed");
    load();
  }

  const filtered = students.filter(
    (s) =>
      s.full_name.toLowerCase().includes(q.toLowerCase()) ||
      s.student_id.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or ID…"
            className="pl-9 h-11"
          />
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button className="h-11">
              <Plus className="mr-1 h-4 w-4" /> Add student
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Add a student</SheetTitle>
            </SheetHeader>
            <form onSubmit={addStudent} className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Student ID</Label>
                <Input
                  required
                  placeholder="STU-006"
                  value={form.student_id}
                  onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Year level</Label>
                <Select
                  value={form.year_level}
                  onValueChange={(v) => setForm({ ...form, year_level: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={busy} className="w-full h-11">
                {busy ? "Adding…" : "Add student"}
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      <div className="rounded-xl bg-card border border-border overflow-hidden">
        {/* Desktop table */}
        <table className="hidden md:table w-full text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">ID</th>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Year</th>
              <th className="px-4 py-2 text-left">Sessions</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-4 py-2 font-medium">{s.student_id}</td>
                <td className="px-4 py-2">{s.full_name}</td>
                <td className="px-4 py-2">{s.year_level}</td>
                <td className="px-4 py-2">{counts[s.student_id] ?? 0}</td>
                <td className="px-4 py-2 text-right">
                  <DeleteBtn onConfirm={() => remove(s.id)} name={s.full_name} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Mobile cards */}
        <ul className="md:hidden divide-y divide-border">
          {filtered.map((s) => (
            <li key={s.id} className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{s.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.student_id} · {s.year_level} · {counts[s.student_id] ?? 0} sessions
                </p>
              </div>
              <DeleteBtn onConfirm={() => remove(s.id)} name={s.full_name} />
            </li>
          ))}
        </ul>
        {filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No students found.
          </div>
        )}
      </div>
    </div>
  );
}

function DeleteBtn({ onConfirm, name }: { onConfirm: () => void; name: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will also remove all attendance records for this student.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Remove</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}