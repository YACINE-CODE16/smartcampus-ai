import { Download } from 'lucide-react';
import { useState } from 'react';
import { download } from '../lib/api';
import { useI18n } from '../lib/i18n';

/** US-33 : export CSV authentifié (le jeton Cognito ne peut pas voyager dans un simple lien). */
export function ExportButton({ path, fileName }: { path: string; fileName: string }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function run() {
    setBusy(true);
    setFailed(false);
    try {
      await download(path, fileName);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn btn--secondary" onClick={() => void run()} disabled={busy} aria-describedby={failed ? 'export-error' : undefined}>
      <Download size={16} strokeWidth={1.75} aria-hidden="true" />
      {busy ? t('Export…', 'Exporting…') : t('Exporter en CSV', 'Export to CSV')}
      {failed && (
        <span id="export-error" role="alert" className="sr-only">
          {t('Export impossible, réessayez.', 'Export failed, try again.')}
        </span>
      )}
    </button>
  );
}
