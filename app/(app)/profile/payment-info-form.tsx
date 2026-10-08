"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deletePaymentInfo, savePaymentInfo } from "@/server-actions/payment-info";
import type { FieldErrors } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/field-error";

const BANKS = [
  "BancoEstado", "Banco de Chile", "Banco Santander", "BCI", "Scotiabank", "Itaú", "Banco Falabella",
  "Banco Ripley", "Banco Security", "Banco BICE", "Banco Consorcio", "Mercado Pago", "Tenpo", "MACH", "Copec Pay",
];
const ACCOUNT_TYPES = ["Cuenta Corriente", "Cuenta Vista", "CuentaRUT", "Cuenta de Ahorro", "Chequera Electrónica"];

type Values = Record<"holderName" | "rut" | "bank" | "accountType" | "accountNumber" | "email" | "notes", string>;

export function PaymentInfoForm({ initial, hasSaved }: { initial: Values; hasSaved: boolean }) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();
  const field = (k: keyof Values) => ({
    id: k,
    value: v[k],
    "aria-invalid": !!errors[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value }),
  });

  return (
    <form
      className="grid gap-4"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await savePaymentInfo(v);
          if (!res.ok) {
            setErrors(res.fieldErrors ?? {});
            return void toast.error(res.error);
          }
          setErrors({});
          toast.success("Datos guardados");
        });
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="holderName">Nombre del titular</Label>
        <Input {...field("holderName")} maxLength={100} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="rut">RUT</Label>
          <Input {...field("rut")} placeholder="12.345.678-5" maxLength={12} />
          <FieldError errors={errors.rut} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="bank">Banco</Label>
          <Input {...field("bank")} list="banks" maxLength={60} />
          <datalist id="banks">{BANKS.map((b) => <option key={b} value={b} />)}</datalist>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="accountType">Tipo de cuenta</Label>
          <Input {...field("accountType")} list="account-types" maxLength={40} />
          <datalist id="account-types">{ACCOUNT_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="accountNumber">N° de cuenta</Label>
          <Input {...field("accountNumber")} inputMode="numeric" maxLength={30} />
          <FieldError errors={errors.accountNumber} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Correo para el comprobante</Label>
        <Input {...field("email")} type="email" maxLength={120} />
        <FieldError errors={errors.email} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="notes">Otros medios (opcional)</Label>
        <Textarea {...field("notes")} placeholder="Ej: PayPal tu@correo.com" maxLength={300} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? "Guardando…" : "Guardar datos"}
        </Button>
        {hasSaved && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (!confirm("¿Borrar tus datos de transferencia?")) return;
              startTransition(async () => {
                const res = await deletePaymentInfo();
                if (res.ok) {
                  toast.success("Datos borrados");
                  setV({ holderName: "", rut: "", bank: "", accountType: "", accountNumber: "", email: "", notes: "" });
                } else toast.error(res.error);
              });
            }}
          >
            Borrar
          </Button>
        )}
      </div>
    </form>
  );
}
