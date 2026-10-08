"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowRightLeft, Copy, Landmark, Receipt } from "lucide-react";
import { toast } from "sonner";
import { createExpense } from "@/server-actions/expenses";
import { createTransfer } from "@/server-actions/transfers";
import { CATEGORIES, CATEGORY_LABEL, SPLIT_LABEL, SPLIT_TYPES, type Category, type SplitTypeValue } from "@/lib/constants";
import { formatMoney, inputStep, todayISO, toMajor, toMinor } from "@/lib/money";
import { splitEqually } from "@/lib/finance/split";
import { PAYMENT_FIELDS, paymentInfoText } from "@/lib/payment-info";
import type { FieldErrors } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/field-error";
import type { MemberLite } from "./types";

type Tab = "expense" | "transfer";

type Props = {
  tripId: string;
  currency: string;
  members: MemberLite[];
  meId: string;
  trigger: React.ReactNode;
  defaultTab?: Tab;
  /** Para "Registrar este pago" desde la liquidación (monto en unidades mínimas). */
  transferPreset?: { fromMemberId: string; toMemberId: string; amount: number };
};

/** Modal único para registrar un gasto o un abono entre personas. */
export function RecordDialog({ trigger, defaultTab = "expense", ...props }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(defaultTab);
  const close = () => setOpen(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setTab(defaultTab);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tab === "expense" ? "Registrar gasto" : "Registrar abono"}</DialogTitle>
          <DialogDescription>
            {tab === "expense" ? "Quién pagó y cómo se divide." : "Un pago directo entre dos integrantes."}
          </DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="expense">
              <Receipt /> Gasto
            </TabsTrigger>
            <TabsTrigger value="transfer">
              <ArrowRightLeft /> Abono
            </TabsTrigger>
          </TabsList>
          <TabsContent value="expense">
            <ExpenseForm {...props} onDone={close} />
          </TabsContent>
          <TabsContent value="transfer">
            <TransferForm {...props} onDone={close} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Los inputs numéricos entregan "" o "12.5"; "" cuenta como 0.
const num = (s: string) => (s.trim() === "" ? 0 : Number(s));

type FormProps = Omit<Props, "trigger" | "defaultTab"> & { onDone: () => void };

function ExpenseForm({ tripId, currency, members, meId, onDone }: FormProps) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("FOOD");
  const [date, setDate] = useState(todayISO);
  const [notes, setNotes] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [receiptNote, setReceiptNote] = useState("");

  const [payMode, setPayMode] = useState<"single" | "multiple">("single");
  const [payerId, setPayerId] = useState(meId);
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({});

  const [splitType, setSplitType] = useState<SplitTypeValue>("EQUAL_ALL");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(members.map((m) => m.id)));
  const [exact, setExact] = useState<Record<string, string>>({});

  const totalMinor = toMinor(num(amount), currency);
  const step = inputStep(currency);
  const fmt = (minor: number) => formatMoney(minor, currency);

  // Vista previa en vivo de cuánto le toca a cada uno (misma función que el servidor).
  const preview = useMemo(() => {
    if (totalMinor <= 0) return new Map<string, number>();
    if (splitType === "EXACT") {
      return new Map(members.map((m) => [m.id, toMinor(num(exact[m.id] ?? ""), currency)]));
    }
    const ids = splitType === "EQUAL_ALL" ? members.map((m) => m.id) : [...selected];
    return ids.length ? new Map(splitEqually(totalMinor, ids).map((s) => [s.memberId, s.amount])) : new Map();
  }, [totalMinor, splitType, members, selected, exact, currency]);

  const exactRemaining = totalMinor - [...preview.values()].reduce((a, b) => a + b, 0);
  const payersRemaining =
    totalMinor - members.reduce((a, m) => a + toMinor(num(payerAmounts[m.id] ?? ""), currency), 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = {
      tripId,
      title,
      notes,
      amount: num(amount),
      category,
      date,
      receiptUrl,
      receiptNote,
      paidBy:
        payMode === "single"
          ? { mode: "single" as const, memberId: payerId }
          : {
              mode: "multiple" as const,
              payers: members
                .map((m) => ({ memberId: m.id, amount: num(payerAmounts[m.id] ?? "") }))
                .filter((p) => p.amount > 0),
            },
      split:
        splitType === "EQUAL_ALL"
          ? { type: "EQUAL_ALL" as const }
          : splitType === "EQUAL_SELECTED"
            ? { type: "EQUAL_SELECTED" as const, memberIds: [...selected] }
            : {
                type: "EXACT" as const,
                shares: members
                  .map((m) => ({ memberId: m.id, amount: num(exact[m.id] ?? "") }))
                  .filter((s) => s.amount > 0),
              },
    };
    startTransition(async () => {
      const res = await createExpense(input);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success("Gasto registrado");
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="title">Descripción</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cena en Puerto Natales" required aria-invalid={!!errors.title} />
        <FieldError errors={errors.title} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="amount">Monto total ({currency})</Label>
          <Input id="amount" type="number" inputMode="decimal" min={0} step={step} value={amount} onChange={(e) => setAmount(e.target.value)} required aria-invalid={!!errors.amount} />
          <FieldError errors={errors.amount} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="date">Fecha</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="category">Categoría</Label>
        <NativeSelect id="category" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </NativeSelect>
      </div>

      {/* Quién pagó */}
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Quién pagó</legend>
        <Segmented
          value={payMode}
          onChange={setPayMode}
          options={[
            { value: "single", label: "Una persona" },
            { value: "multiple", label: "Pago compartido" },
          ]}
        />
        {payMode === "single" ? (
          <NativeSelect value={payerId} onChange={(e) => setPayerId(e.target.value)} aria-label="Pagado por">
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id === meId ? `${m.name} (yo)` : m.name}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <MemberAmountList members={members} values={payerAmounts} onChange={setPayerAmounts} step={step} meId={meId} />
        )}
        {payMode === "multiple" && totalMinor > 0 && (
          <RemainingHint remaining={payersRemaining} fmt={fmt} what="pagos" />
        )}
        <FieldError errors={errors.paidBy} />
      </fieldset>

      {/* Cómo se divide */}
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Cómo se divide</legend>
        <NativeSelect value={splitType} onChange={(e) => setSplitType(e.target.value as SplitTypeValue)} aria-label="Tipo de división">
          {SPLIT_TYPES.map((t) => (
            <option key={t} value={t}>
              {SPLIT_LABEL[t]}
            </option>
          ))}
        </NativeSelect>

        {splitType === "EXACT" ? (
          <>
            <MemberAmountList members={members} values={exact} onChange={setExact} step={step} meId={meId} />
            {totalMinor > 0 && <RemainingHint remaining={exactRemaining} fmt={fmt} what="montos" />}
          </>
        ) : (
          <ul className="divide-y rounded-md border">
            {members.map((m) => {
              const included = splitType === "EQUAL_ALL" || selected.has(m.id);
              return (
                <li key={m.id} className="flex items-center gap-3 px-3 py-2">
                  {splitType === "EQUAL_SELECTED" && (
                    <input
                      type="checkbox"
                      className="accent-primary size-4"
                      checked={included}
                      aria-label={`Incluir a ${m.name}`}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(m.id);
                        else next.delete(m.id);
                        setSelected(next);
                      }}
                    />
                  )}
                  <Avatar name={m.name} image={m.image} className="size-6" />
                  <span className={cn("flex-1 truncate text-sm", !included && "text-muted-foreground line-through")}>
                    {m.name}
                  </span>
                  <span className="text-muted-foreground text-sm tabular-nums">
                    {included && preview.has(m.id) ? fmt(preview.get(m.id)!) : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <FieldError errors={errors.split} />
      </fieldset>

      <details className="group rounded-md border px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">Comprobante y notas</summary>
        <div className="mt-3 grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="receiptUrl">URL del comprobante</Label>
            <Input id="receiptUrl" type="url" placeholder="https://…" value={receiptUrl} onChange={(e) => setReceiptUrl(e.target.value)} aria-invalid={!!errors.receiptUrl} />
            <FieldError errors={errors.receiptUrl} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="receiptNote">Referencia</Label>
            <Input id="receiptNote" placeholder="Boleta N° 12345" value={receiptNote} onChange={(e) => setReceiptNote(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      </details>

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar gasto"}
      </Button>
    </form>
  );
}

function TransferForm({ tripId, currency, members, meId, transferPreset, onDone }: FormProps) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});
  const firstOther = members.find((m) => m.id !== meId)?.id ?? "";
  const [fromId, setFromId] = useState(transferPreset?.fromMemberId ?? meId);
  const [toId, setToId] = useState(transferPreset?.toMemberId ?? firstOther);
  const [amount, setAmount] = useState(transferPreset ? String(toMajor(transferPreset.amount, currency)) : "");
  const [date, setDate] = useState(todayISO);
  const [note, setNote] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createTransfer({
        tripId,
        fromMemberId: fromId,
        toMemberId: toId,
        amount: num(amount),
        date,
        note,
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success("Abono registrado");
      onDone();
    });
  }

  const label = (m: MemberLite) => (m.id === meId ? `${m.name} (yo)` : m.name);

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <div className="grid gap-2">
          <Label htmlFor="from">Pagó</Label>
          <NativeSelect id="from" value={fromId} onChange={(e) => setFromId(e.target.value)}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {label(m)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <ArrowRightLeft className="text-muted-foreground mb-2.5 size-4" />
        <div className="grid gap-2">
          <Label htmlFor="to">A</Label>
          <NativeSelect id="to" value={toId} onChange={(e) => setToId(e.target.value)} aria-invalid={!!errors.toMemberId}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {label(m)}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <FieldError errors={errors.toMemberId} />
      <RecipientPaymentInfo member={members.find((m) => m.id === toId)} isMe={toId === meId} />
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="t-amount">Monto ({currency})</Label>
          <Input id="t-amount" type="number" inputMode="decimal" min={0} step={inputStep(currency)} value={amount} onChange={(e) => setAmount(e.target.value)} required aria-invalid={!!errors.amount} />
          <FieldError errors={errors.amount} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="t-date">Fecha</Label>
          <Input id="t-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="t-note">Nota</Label>
        <Input id="t-note" placeholder="Transferencia BancoEstado" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar abono"}
      </Button>
    </form>
  );
}

function MemberAmountList({
  members,
  values,
  onChange,
  step,
  meId,
}: {
  members: MemberLite[];
  values: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  step: string;
  meId: string;
}) {
  return (
    <ul className="divide-y rounded-md border">
      {members.map((m) => (
        <li key={m.id} className="flex items-center gap-3 px-3 py-1.5">
          <Avatar name={m.name} image={m.image} className="size-6" />
          <span className="flex-1 truncate text-sm">{m.id === meId ? `${m.name} (yo)` : m.name}</span>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={step}
            placeholder="0"
            className="h-8 w-32 text-right"
            aria-label={`Monto de ${m.name}`}
            value={values[m.id] ?? ""}
            onChange={(e) => onChange({ ...values, [m.id]: e.target.value })}
          />
        </li>
      ))}
    </ul>
  );
}

function RemainingHint({ remaining, fmt, what }: { remaining: number; fmt: (n: number) => string; what: string }) {
  if (remaining === 0) return <p className="text-xs text-emerald-600 dark:text-emerald-400">Los {what} cuadran con el total ✓</p>;
  return (
    <p className="text-destructive text-xs">
      {remaining > 0 ? `Faltan ${fmt(remaining)} por asignar` : `Te pasaste por ${fmt(-remaining)}`}
    </p>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2 py-1 text-sm font-medium transition-colors",
            value === o.value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Datos bancarios de quien recibe el abono, con botón para copiarlos. */
function RecipientPaymentInfo({ member, isMe }: { member?: MemberLite; isMe: boolean }) {
  if (!member || isMe) return null;
  const info = member.payment;
  if (!info || !PAYMENT_FIELDS.some(([k]) => info[k])) {
    return (
      <p className="text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs">
        {member.name} aún no agregó sus datos de transferencia.
      </p>
    );
  }
  return (
    <div className="bg-muted/50 rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Landmark className="size-4" /> Datos de {member.name}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => navigator.clipboard.writeText(paymentInfoText(info)).then(() => toast.success("Datos copiados"))}
        >
          <Copy /> Copiar
        </Button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        {PAYMENT_FIELDS.filter(([k]) => info[k]).map(([k, label]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium break-all">{info[k]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
