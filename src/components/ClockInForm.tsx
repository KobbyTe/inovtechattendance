import { useEffect, useState } from "react";
import { LogIn, LogOut, Check, ChevronsUpDown, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Student } from "@/types";
import {
  getDayName,
  isMeetingDay,
  todayDateStr,
} from "@/lib/attendance";

export function ClockInForm() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const meetingDay = isMeetingDay();

  useEffect(() => {
    supabase
      .from("students")
      .select("*")
      .order("student_id")
      .then(({ data, error }) => {
        if (error) toast.error("Failed to load students");
        else setStudents((data ?? []) as Student[]);
      });
  }, []);

  const selected = students.find((s) => s.student_id === selectedId);

  async function handleClockIn() {
    if (!selected) return toast.error("Please select your name first");
    if (!meetingDay)
      return toast.error("Attendance only on Wednesday, Thursday, and Friday");
    setBusy(true);
    try {
      const today = todayDateStr();
      const { data: existing } = await supabase
        .from("attendance")
        .select("id, clock_out")
        .eq("student_id", selected.student_id)
        .eq("date", today)
        .is("clock_out", null)
        .maybeSingle();
      if (existing) {
        toast.error("You are already clocked in today.");
        return;
      }
      const { error } = await supabase.from("attendance").insert({
        student_id: selected.student_id,
        student_name: selected.full_name,
        date: today,
        day_name: getDayName(),
      });
      if (error) throw error;
      toast.success(`Welcome, ${selected.full_name.split(" ")[0]}! Clocked in.`);
    } catch (e) {
      toast.error("Could not clock in. Please try again.");
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  async function handleClockOut() {
    if (!selected) return toast.error("Please select your name first");
    if (!meetingDay)
      return toast.error("Attendance only on Wednesday, Thursday, and Friday");
    setBusy(true);
    try {
      const today = todayDateStr();
      const { data: open } = await supabase
        .from("attendance")
        .select("id")
        .eq("student_id", selected.student_id)
        .eq("date", today)
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .maybeSingle();
      if (!open) {
        toast.error("No active clock-in found for today.");
        return;
      }
      const { error } = await supabase
        .from("attendance")
        .update({ clock_out: new Date().toISOString() })
        .eq("id", open.id);
      if (error) throw error;
      toast.success(`Goodbye, ${selected.full_name.split(" ")[0]}! Clocked out.`);
    } catch (e) {
      toast.error("Could not clock out. Please try again.");
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full h-14 justify-between text-base bg-card"
          >
            {selected ? (
              <span className="truncate">
                {selected.student_id} — {selected.full_name}
              </span>
            ) : (
              <span className="text-muted-foreground">Select your name…</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search by ID or name…" />
            <CommandList>
              <CommandEmpty>No student found.</CommandEmpty>
              <CommandGroup>
                {students.map((s) => (
                  <CommandItem
                    key={s.student_id}
                    value={`${s.student_id} ${s.full_name}`}
                    onSelect={() => {
                      setSelectedId(s.student_id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedId === s.student_id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="font-medium">{s.student_id}</span>
                    <span className="ml-2 text-muted-foreground">{s.full_name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected && (
        <div className="rounded-lg bg-accent/60 border border-accent p-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{selected.full_name}</p>
            <p className="text-xs text-muted-foreground">
              {selected.student_id} · {selected.year_level}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <Button
          onClick={handleClockIn}
          disabled={busy || !meetingDay}
          className="w-full h-14 text-base bg-primary hover:bg-primary/90"
        >
          <LogIn className="mr-2 h-5 w-5" /> Clock In
        </Button>
        <Button
          onClick={handleClockOut}
          disabled={busy || !meetingDay}
          variant="outline"
          className="w-full h-14 text-base border-primary text-primary hover:bg-accent"
        >
          <LogOut className="mr-2 h-5 w-5" /> Clock Out
        </Button>
      </div>
    </div>
  );
}