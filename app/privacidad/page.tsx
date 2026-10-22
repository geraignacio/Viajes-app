import { LegalPage } from "@/components/legal/legal-page";

export const metadata = { title: "Política de privacidad" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidad">
      <p>
        Viajes es una app para que un grupo de amigos o familia lleve los gastos compartidos de un viaje y guarde sus
        fotos y videos en un álbum común.
      </p>

      <h2>Qué datos usamos</h2>
      <ul>
        <li>De tu cuenta de Google: nombre, correo y foto de perfil, para identificarte en los viajes.</li>
        <li>Lo que registras en la app: viajes, gastos, abonos y, si los agregas, tus datos para recibir transferencias.</li>
        <li>
          Google Drive (solo si activas las fotos de un viaje): la app usa el permiso <i>drive.file</i>, que le da acceso
          únicamente a la carpeta y los archivos que ella misma crea. No puede ver ni modificar el resto de tu Drive.
        </li>
      </ul>

      <h2>Para qué los usamos</h2>
      <ul>
        <li>Mostrar los saldos y movimientos a los integrantes de cada viaje.</li>
        <li>
          Guardar en tu Drive las fotos y videos que el grupo sube, y compartir esa carpeta (solo lectura) con los
          integrantes del viaje.
        </li>
      </ul>
      <p>
        No vendemos tus datos, no mostramos publicidad y no los compartimos con nadie fuera de los integrantes de tus
        viajes. El uso y la transferencia de la información recibida de las APIs de Google cumplen con la{" "}
        <a
          className="text-primary underline"
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noreferrer"
        >
          Política de Datos de Usuario de los Servicios de API de Google
        </a>
        , incluidos los requisitos de Uso Limitado.
      </p>

      <h2>Dónde se guardan</h2>
      <p>
        Los datos de la app se guardan en una base de datos en Supabase y la app funciona en Vercel. Las fotos y videos
        quedan en el Google Drive de quien activó el álbum del viaje.
      </p>

      <h2>Cómo borrarlos</h2>
      <ul>
        <li>Puedes borrar tus gastos, abonos, fotos y datos de transferencia desde la app.</li>
        <li>
          Puedes quitarle el acceso a la app en{" "}
          <a className="text-primary underline" href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
            myaccount.google.com/permissions
          </a>
          . Las fotos que ya están en tu Drive siguen siendo tuyas.
        </li>
        <li>Para borrar tu cuenta por completo, pídeselo al organizador de tu viaje.</li>
      </ul>
    </LegalPage>
  );
}
