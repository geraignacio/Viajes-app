import { LegalPage } from "@/components/legal/legal-page";

export const metadata = { title: "Condiciones del servicio" };

export default function TermsPage() {
  return (
    <LegalPage title="Condiciones del servicio">
      <p>
        Viajes es una app gratuita y de uso personal para llevar los gastos compartidos de un viaje entre amigos o
        familia y guardar sus fotos.
      </p>
      <ul>
        <li>Cada persona es responsable de lo que registra y sube: gastos, abonos, fotos y videos.</li>
        <li>
          Los saldos son una ayuda para ordenarse. La app no mueve dinero: los pagos se hacen fuera de ella, entre las
          personas.
        </li>
        <li>Sube solo fotos y videos que tengas derecho a compartir con tu grupo.</li>
        <li>
          La app se ofrece tal cual, sin garantías. Puede cambiar o dejar de estar disponible; descarga lo que quieras
          conservar (las fotos siempre quedan en Google Drive).
        </li>
      </ul>
      <p>
        El tratamiento de tus datos se explica en la{" "}
        <a className="text-primary underline" href="/privacidad">
          política de privacidad
        </a>
        .
      </p>
    </LegalPage>
  );
}
