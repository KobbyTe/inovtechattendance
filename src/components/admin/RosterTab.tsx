import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Student } from "@/types";
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

const YEARS = ["Year 1", "Year 2", "Year 3", "Year 4"];

export function RosterTab() {
  const [students, setStudents] = useState<Student[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ student_id: "", full_name: "", year_level: "Year 1" });
  const [busy, setBusy] = useState(false);

  async function load() {
    const [{ data: ss }, { data: att }] = await Promise.all([
      supabase.from("students").select("*").order("student_id"),
      supabase.from("attendance").select("student_id"),
    ]);
    setStudents((ss ?? []) as Student[]);
    const c: Record<string, number> = {};
    for (const r of att ?? []) c[r.student_id] = (c[r.student_id] ?? 0) + 1;
    setCounts(c);
  }
  useEffect(() => {
    load();
  }, []);

  async function addStudent(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("students").insert(form);
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