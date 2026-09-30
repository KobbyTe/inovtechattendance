import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  GraduationCap,
  Info,
  Loader2,
  Mail,
  Phone,
  Radio,
  ShieldCheck,
  Sparkles,
  User,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PassportPhotoInput } from "@/components/admin/PassportPhotoInput";
import { createStudent } from "@/lib/students.functions";
import { addStudentSchema, type AddStudentInput } from "@/lib/student-validation";
import { previewStudentId } from "@/lib/cohorts";
import type { Cohort, Student } from "@/types";

const YEARS = ["Year 1", "Year 2", "Year 3", "Year 4"] as const;
const STEPS = ["Student Details", "Guardian Details", "Review & Add"];

const EMPTY_FORM: AddStudentInput = {
  full_name: "",
  cohort_id: "",
  year_level: "Year 1",
  guardian_name: "",
  guardian_email: "",
  guardian_phone: "",
  student_email: "",
  rfid_uid: "",
  photo_url: "",
};

type FieldName = keyof AddStudentInput;
type FieldErrors = Partial<Record<FieldName, string>>;

export function AddStudentDialog({
  open,
  onOpenChange,
  cohorts,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cohorts: Cohort[];
  onCreated: (student: Student) => void;
}) {
  const create = useServerFn(createStudent);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<AddStudentInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const selectedCohort = useMemo(
    () => cohorts.find((cohort) => cohort.id === form.cohort_id),
    [cohorts, form.cohort_id],
  );

  function update<K extends FieldName>(field: K, value: AddStudentInput[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validate(fields: FieldName[]) {
    const result = addStudentSchema.safeParse(form);
    const next: FieldErrors = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0] as FieldName | undefined;
        if (field && fields.includes(field) && !next[field]) next[field] = issue.message;
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goNext() {
    const fields: FieldName[] = step === 1
      ? ["photo_url", "full_name", "cohort_id", "year_level"]
      : ["guardian_name", "guardian_email", "guardian_phone", "student_email", "rfid_uid"];
    if (validate(fields)) setStep((current) => Math.min(3, current + 1));
  }

  function close() {
    if (busy) return;
    onOpenChange(false);
    window.setTimeout(() => {
      setStep(1);
      setErrors({});
      setForm(EMPTY_FORM);
    }, 180);
  }

  async function submit() {
    if (!validate(Object.keys(EMPTY_FORM) as FieldName[])) return;
    setBusy(true);
    try {
      const student = await create({ data: form });
      onCreated(student as Student);
      toast.success(`${student.full_name} has been added`, {
        description: `Student ID: ${student.student_id}`,
      });
      close();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the student");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="student-dialog max-h-[96dvh] w-[calc(100%-1rem)] max-w-6xl gap-0 overflow-hidden border-student-line bg-student-panel p-0 text-student-text shadow-2xl sm:rounded-2xl [&>button]:right-4 [&>button]:top-4 [&>button]:z-20 [&>button]:text-student-muted [&>button:hover]:text-student-text">
        <DialogTitle className="sr-only">Add a student</DialogTitle>
        <DialogDescription className="sr-only">Add a student in three steps.</DialogDescription>
        <div className="grid max-h-[96dvh] min-h-[640px] lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="student-dialog-aside relative overflow-hidden border-b border-student-line p-5 sm:p-7 lg:border-b-0 lg:border-r">
            <div className="relative z-10 flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-student-action text-student-text shadow-lg">
                <UserPlus className="h-7 w-7" />
              </span>
              <div className="min-w-0">
                <h2 className="text-2xl font-bold sm:text-3xl">Add a <span className="text-student-accent">Student</span></h2>
                <p className="mt-1 text-xs text-student-muted sm:text-sm">Register a student in the attendance system.</p>
              </div>
            </div>

            <div className="relative z-10 mt-6 hidden rounded-2xl border border-student-line bg-student-glass p-4 lg:block">
              <div className="grid min-h-40 place-items-center rounded-xl border border-student-line bg-student-field">
                {form.photo_url ? (
                  <img src={form.photo_url} alt="Student preview" className="h-36 w-28 rounded-lg border border-student-line object-cover shadow-xl" />
                ) : (
                  <div className="text-center">
                    <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-student-action shadow-lg"><Camera className="h-8 w-8" /></span>
                    <p className="mt-3 font-semibold">Passport photo</p>
                    <p className="text-xs text-student-muted">Upload on step one</p>
                  </div>
                )}
              </div>
              <p className="mt-3 text-center text-xs text-student-muted">Any photo works — it is cropped to passport size automatically.</p>
            </div>

            <div className="relative z-10 mt-4 hidden rounded-xl border border-student-line bg-student-glass p-4 lg:block">
              <p className="flex items-center gap-2 text-sm font-semibold"><Info className="h-4 w-4 text-student-accent" /> Photo guidelines</p>
              <ul className="mt-3 space-y-2 text-xs text-student-muted">
                {["Clear and well-lit photo", "Face should be front-facing", "No hats or sunglasses", "Plain background recommended"].map((item) => (
                  <li key={item} className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-student-success" /> {item}</li>
                ))}
              </ul>
            </div>
          </aside>

          <div className="flex min-w-0 flex-col overflow-hidden">
            <div className="border-b border-student-line px-5 pb-4 pt-16 sm:px-8 sm:pt-7">
              <ol className="grid grid-cols-3 items-start">
                {STEPS.map((label, index) => {
                  const number = index + 1;
                  const active = number === step;
                  const complete = number < step;
                  return (
                    <li key={label} className="relative flex min-w-0 flex-col items-center gap-2 text-center sm:flex-row sm:text-left">
                      {index < 2 ? <span className="absolute left-[58%] right-[-42%] top-5 h-px bg-student-line sm:left-12 sm:right-3" /> : null}
                      <span className={`relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border font-semibold ${active || complete ? "border-student-accent bg-student-action text-student-text shadow-lg" : "border-student-line bg-student-field text-student-muted"}`}>
                        {complete ? <Check className="h-4 w-4" /> : number}
                      </span>
                      <span className={`relative z-10 truncate text-[10px] font-medium sm:text-xs ${active ? "text-student-accent" : "text-student-muted"}`}>{label}</span>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
              {step === 1 ? (
                <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
                  <PassportPhotoInput value={form.photo_url || null} onChange={(value) => update("photo_url", value ?? "")} label="Add photo" premium error={errors.photo_url} />
                  <div className="space-y-5">
                    <Field icon={User} label="Full name" error={errors.full_name}>
                      <Input value={form.full_name} onChange={(event) => update("full_name", event.target.value)} placeholder="e.g. Kwame Mensah" autoFocus className="student-input" aria-invalid={!!errors.full_name} />
                    </Field>
                    <Field icon={GraduationCap} label="Cohort" error={errors.cohort_id}>
                      <Select value={form.cohort_id} onValueChange={(value) => update("cohort_id", value)}>
                        <SelectTrigger className="student-input"><SelectValue placeholder="Choose cohort" /></SelectTrigger>
                        <SelectContent>{cohorts.map((cohort) => <SelectItem key={cohort.id} value={cohort.id}>{cohort.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <Field icon={CalendarDays} label="Year level" error={errors.year_level}>
                      <Select value={form.year_level} onValueChange={(value) => update("year_level", value as AddStudentInput["year_level"])}>
                        <SelectTrigger className="student-input"><SelectValue /></SelectTrigger>
                        <SelectContent>{YEARS.map((year) => <SelectItem key={year} value={year}>{year}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    {selectedCohort && form.full_name.trim() ? (
                      <div className="rounded-lg border border-student-line bg-student-field px-4 py-3 text-xs text-student-muted">
                        Preview ID <span className="ml-2 font-mono font-semibold text-student-text">{previewStudentId(selectedCohort.code, form.full_name)}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2"><Field icon={User} label="Guardian / Parent name" error={errors.guardian_name}><Input value={form.guardian_name} onChange={(event) => update("guardian_name", event.target.value)} placeholder="e.g. Ama Serwaa" className="student-input" autoFocus aria-invalid={!!errors.guardian_name} /></Field></div>
                  <Field icon={Mail} label="Guardian / Parent email" error={errors.guardian_email}><Input type="email" value={form.guardian_email} onChange={(event) => update("guardian_email", event.target.value)} placeholder="e.g. parent@example.com" className="student-input" aria-invalid={!!errors.guardian_email} /></Field>
                  <Field icon={Phone} label="Guardian / Parent phone" error={errors.guardian_phone}><Input type="tel" value={form.guardian_phone} onChange={(event) => update("guardian_phone", event.target.value)} placeholder="024 123 4567 or +233241234567" className="student-input" aria-invalid={!!errors.guardian_phone} /></Field>
                  <Field icon={Mail} label="Student email" optional error={errors.student_email}><Input type="email" value={form.student_email} onChange={(event) => update("student_email", event.target.value)} placeholder="e.g. student@example.com" className="student-input" aria-invalid={!!errors.student_email} /></Field>
                  <Field icon={Radio} label="RFID card UID" optional error={errors.rfid_uid}><Input value={form.rfid_uid} onChange={(event) => update("rfid_uid", event.target.value)} placeholder="e.g. 04A2B3C4" className="student-input font-mono uppercase" aria-invalid={!!errors.rfid_uid} /></Field>
                  <div className="sm:col-span-2 flex items-center gap-3 rounded-lg border border-student-line bg-student-field p-4 text-xs text-student-muted"><ShieldCheck className="h-5 w-5 shrink-0 text-student-accent" /> Contact details are used for attendance and guardian notifications.</div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-5">
                  <div className="flex flex-col items-center gap-4 rounded-xl border border-student-line bg-student-glass p-5 text-center sm:flex-row sm:text-left">
                    <img src={form.photo_url} alt={form.full_name} className="h-32 w-24 shrink-0 rounded-lg border border-student-line object-cover shadow-xl" />
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-student-success-soft px-3 py-1 text-xs font-semibold text-student-success"><Sparkles className="h-3.5 w-3.5" /> Ready to add</span>
                      <h3 className="mt-3 text-2xl font-bold">{form.full_name}</h3>
                      <p className="mt-1 text-sm text-student-muted">{selectedCohort?.name} · {form.year_level}</p>
                      <p className="mt-2 font-mono text-xs text-student-accent">{selectedCohort ? previewStudentId(selectedCohort.code, form.full_name) : ""}</p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ReviewItem label="Guardian / Parent" value={form.guardian_name} />
                    <ReviewItem label="Guardian email" value={form.guardian_email} />
                    <ReviewItem label="Guardian phone" value={form.guardian_phone} />
                    <ReviewItem label="Student email" value={form.student_email || "Not provided"} />
                    <ReviewItem label="RFID card UID" value={form.rfid_uid || "Not assigned"} />
                    <ReviewItem label="Cohort" value={selectedCohort?.name ?? "—"} />
                  </div>
                </div>
              ) : null}
            </div>

            <footer className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-t border-student-line bg-student-footer px-5 py-4 sm:flex sm:justify-end sm:px-8">
              <Button type="button" variant="outline" onClick={step === 1 ? close : () => setStep((current) => current - 1)} disabled={busy} className="h-11 border-student-line bg-student-field px-5 text-student-text hover:bg-student-accent-soft hover:text-student-text">
                {step === 1 ? "Cancel" : <><ArrowLeft /> Back</>}
              </Button>
              {step < 3 ? (
                <Button type="button" onClick={goNext} className="h-11 justify-self-end bg-student-action px-6 text-student-text hover:opacity-90">Next <ArrowRight /></Button>
              ) : (
                <Button type="button" onClick={submit} disabled={busy} className="h-11 justify-self-end bg-student-action px-6 text-student-text hover:opacity-90">
                  {busy ? <Loader2 className="animate-spin" /> : <UserPlus />} {busy ? "Adding student…" : "Add student"}
                </Button>
              )}
            </footer>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ icon: Icon, label, optional, error, children }: { icon: typeof User; label: string; optional?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-student-text"><Icon className="h-4 w-4 text-student-accent" /> {label} {optional ? <span className="font-normal text-student-muted">(optional)</span> : <span className="text-student-danger">*</span>}</Label>
      {children}
      {error ? <p className="text-xs text-student-danger">{error}</p> : null}
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-student-line bg-student-field px-4 py-3"><p className="text-[11px] uppercase text-student-muted">{label}</p><p className="mt-1 truncate text-sm font-medium text-student-text">{value}</p></div>;
}